import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type {
    PartMetadataPayload,
    GuideResult,
    DigitalProductPassport,
    GenerateDppResponse,
    BillOfMaterialsEntry,
    MaterialStream,
    ComplianceProfile,
} from '@/types';
import indiaPricing from '@/data/knowledge/scrap_pricing_india.json';
import regulatoryDb from '@/data/knowledge/regulatory_compliance.json';
import { generateAIBOM } from '@/lib/aiGuideGenerator';
import { checkRateLimit } from '@/lib/requestRateLimit';

// ── India scrap price lookup ──────────────────────────────────────────────────
// Returns the Mumbai MIDC (default hub) price per kg for a given material key,
// or null if not found in the India pricing database.
type IndiaMaterial = (typeof indiaPricing.materials)[number];

function indiaScrapPrice(materialKey: string): number | null {
    const match = (indiaPricing.materials as IndiaMaterial[]).find(
        m => m.id === materialKey ||
            (m.common_names as string[]).some(n => n.toLowerCase().includes(materialKey.replace(/_/g, ' ').toLowerCase()))
    );
    if (!match) return null;
    const regional = match.regional_rates_inr_per_kg as Record<string, number>;
    return regional['Mumbai_MIDC'] ?? match.price_tiers.standard.inr_per_kg;
}

// ── Regulatory compliance lookup ──────────────────────────────────────────────
type RegMaterial = (typeof regulatoryDb.materials)[number];

function buildComplianceProfile(materialKey: string, _secondaryKey?: string | null): ComplianceProfile {
    const key = materialKey.toLowerCase();
    const match = (regulatoryDb.materials as RegMaterial[]).find(
        m => m.id === materialKey ||
            m.id.toLowerCase().includes(key) ||
            key.includes(m.id.toLowerCase())
    ) ?? regulatoryDb.materials[0] as RegMaterial; // safe fallback to carbon_steel

    const svhcList = (match.REACH as { svhc_substances_of_concern?: unknown[] }).svhc_substances_of_concern ?? [];
    const haz = match.hazardous_classification as { is_hazardous: boolean; hazard_note?: string; special_disposal_required: boolean };
    const weee = match.WEEE as { applicable: boolean; india_e_waste_rule?: string; notes?: string; reason?: string };
    const espr = match.EU_ESPR_2024 as { recyclability_class: string; end_of_life_route: string; recycled_content_potential_pct?: number };
    const bis = match.BIS_India as { relevant_standards: string[]; e_waste_rule_applicable?: boolean; export_control?: string };
    const rohs = match.RoHS3 as { status: string; notes: string };
    const reach = match.REACH as { status: string; notes: string; action_required?: string };

    return {
        material_id: match.id,
        display_name: match.display_name,
        RoHS3: { status: rohs.status, notes: rohs.notes },
        REACH: { status: reach.status, notes: reach.notes, action_required: reach.action_required, svhc_count: svhcList.length },
        WEEE: { applicable: weee.applicable, india_e_waste_rule: weee.india_e_waste_rule, notes: weee.reason },
        EU_ESPR: {
            recyclability_class: espr.recyclability_class,
            end_of_life_route: espr.end_of_life_route,
            recycled_content_pct: espr.recycled_content_potential_pct,
        },
        BIS_India: {
            relevant_standards: bis.relevant_standards ?? [],
            e_waste_applicable: bis.e_waste_rule_applicable ?? false,
            export_control: bis.export_control,
        },
        is_hazardous: haz.is_hazardous,
        hazard_note: haz.hazard_note,
        special_disposal_required: haz.special_disposal_required,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/generate-dpp
//
// Accepts: { partPayload: PartMetadataPayload, guideResult: GuideResult }
// Returns: GenerateDppResponse { success, dpp, passport_id }
//
// Assembles the full Digital Product Passport JSON from VLM + RAG outputs.
// Attempts to persist to Firestore (gracefully skips if unconfigured).
// ─────────────────────────────────────────────────────────────────────────────

// Material lookup table for BOM generation
const MATERIAL_LOOKUP: Record<
    string,
    { designation: string; recyclability: 'A' | 'B' | 'C'; value_per_kg: number; mass_fraction: number }
> = {
    // ── Industrial metals ─────────────────────────────────────────────────────
    '316L_stainless_steel': { designation: '316L Stainless Steel', recyclability: 'A', value_per_kg: 1.42, mass_fraction: 0.83 },
    stainless_steel_CF8M: { designation: 'CF8M Stainless Steel', recyclability: 'A', value_per_kg: 1.35, mass_fraction: 0.80 },
    carbon_steel: { designation: 'Carbon Steel ASTM A216 WCB', recyclability: 'B', value_per_kg: 0.25, mass_fraction: 0.85 },
    cast_iron: { designation: 'Grey Cast Iron', recyclability: 'B', value_per_kg: 0.12, mass_fraction: 0.88 },
    copper_alloy: { designation: 'Copper Alloy C110', recyclability: 'A', value_per_kg: 8.80, mass_fraction: 0.78 },
    inconel_625: { designation: 'Inconel 625', recyclability: 'A', value_per_kg: 18.50, mass_fraction: 0.82 },
    titanium: { designation: 'Ti-6Al-4V Titanium', recyclability: 'A', value_per_kg: 31.50, mass_fraction: 0.90 },
    aluminium_alloy: { designation: 'Aluminium Alloy', recyclability: 'A', value_per_kg: 2.10, mass_fraction: 0.88 },
    PTFE_seat_ring: { designation: 'PTFE', recyclability: 'C', value_per_kg: 0.08, mass_fraction: 0.02 },
    silicon_carbide_seal: { designation: 'Silicon Carbide', recyclability: 'C', value_per_kg: 0.15, mass_fraction: 0.02 },
    // ── E-waste / battery materials ───────────────────────────────────────────
    lithium_compound: { designation: 'Lithium Cobalt Oxide / LiFePO4 (Cathode)', recyclability: 'B', value_per_kg: 4.20, mass_fraction: 0.28 },
    FR4_fibreglass: { designation: 'FR4 Fibreglass PCB Substrate', recyclability: 'B', value_per_kg: 0.80, mass_fraction: 0.40 },
    silicon: { designation: 'Silicon (Semiconductor)', recyclability: 'B', value_per_kg: 2.50, mass_fraction: 0.15 },
    // ── General waste materials ───────────────────────────────────────────────
    polypropylene: { designation: 'Polypropylene (PP)', recyclability: 'B', value_per_kg: 0.35, mass_fraction: 0.92 },
    PET: { designation: 'Polyethylene Terephthalate (PET)', recyclability: 'A', value_per_kg: 0.42, mass_fraction: 0.92 },
    HDPE: { designation: 'High-Density Polyethylene (HDPE)', recyclability: 'A', value_per_kg: 0.38, mass_fraction: 0.92 },
    glass: { designation: 'Glass (Cullet)', recyclability: 'A', value_per_kg: 0.06, mass_fraction: 0.95 },
    paper: { designation: 'Paper / Cardboard', recyclability: 'A', value_per_kg: 0.08, mass_fraction: 0.90 },
    organic: { designation: 'Organic / Biodegradable', recyclability: 'A', value_per_kg: 0.02, mass_fraction: 0.90 },
};

const DEFAULT_MATERIAL = { designation: 'Mixed Material', recyclability: 'B' as const, value_per_kg: 0.50, mass_fraction: 0.80 };

// Determines if a part class is an industrial component (needs fasteners row)
const INDUSTRIAL_PART_CLASSES = new Set([
    'gate_valve', 'globe_valve', 'ball_valve', 'butterfly_valve', 'check_valve',
    'control_valve', 'centrifugal_pump', 'gear_pump', 'heat_exchanger',
    'pressure_vessel', 'compressor', 'motor', 'circuit_breaker', 'transformer',
    'flange', 'pipe_fitting',
]);

// E-waste BOM templates — defines the actual sub-components for electronic items
const EWASTE_BOM_TEMPLATES: Record<string, Array<{
    component_name: string;
    material_designation: string;
    mass_fraction: number;
    recyclability: 'A' | 'B' | 'C';
    value_per_kg: number;
    hazardous: boolean;
}>> = {
    battery: [
        { component_name: 'cathode_material', material_designation: 'Lithium Cobalt Oxide / LiFePO4 (Cathode)', mass_fraction: 0.28, recyclability: 'B', value_per_kg: 4.20, hazardous: true },
        { component_name: 'anode_material', material_designation: 'Graphite (Anode)', mass_fraction: 0.22, recyclability: 'B', value_per_kg: 1.80, hazardous: false },
        { component_name: 'steel_casing', material_designation: 'Steel Casing', mass_fraction: 0.30, recyclability: 'A', value_per_kg: 0.30, hazardous: false },
        { component_name: 'electrolyte_separator', material_designation: 'Electrolyte / Polypropylene Separator', mass_fraction: 0.12, recyclability: 'C', value_per_kg: 0.00, hazardous: true },
        { component_name: 'copper_current_collector', material_designation: 'Copper Current Collector', mass_fraction: 0.08, recyclability: 'A', value_per_kg: 8.50, hazardous: false },
    ],
    circuit_board: [
        { component_name: 'pcb_substrate', material_designation: 'FR4 Fibreglass Substrate', mass_fraction: 0.40, recyclability: 'B', value_per_kg: 0.80, hazardous: false },
        { component_name: 'copper_traces', material_designation: 'Copper Traces & Pads', mass_fraction: 0.25, recyclability: 'A', value_per_kg: 8.50, hazardous: false },
        { component_name: 'solder_joints', material_designation: 'Lead-Tin Solder (Pb/Sn)', mass_fraction: 0.08, recyclability: 'C', value_per_kg: 0.50, hazardous: true },
        { component_name: 'gold_contacts', material_designation: 'Gold-Plated Contacts', mass_fraction: 0.02, recyclability: 'A', value_per_kg: 4200.00, hazardous: false },
        { component_name: 'ic_chips', material_designation: 'Silicon ICs / Semiconductors', mass_fraction: 0.15, recyclability: 'B', value_per_kg: 2.50, hazardous: false },
        { component_name: 'plastic_housing', material_designation: 'Plastic Housing / Connectors', mass_fraction: 0.10, recyclability: 'C', value_per_kg: 0.10, hazardous: false },
    ],
    mobile_device: [
        { component_name: 'battery', material_designation: 'Lithium Battery Pack', mass_fraction: 0.35, recyclability: 'B', value_per_kg: 2.80, hazardous: true },
        { component_name: 'display', material_designation: 'Glass / OLED Display Panel', mass_fraction: 0.20, recyclability: 'B', value_per_kg: 0.60, hazardous: false },
        { component_name: 'logic_board', material_designation: 'FR4 PCB / Logic Board', mass_fraction: 0.15, recyclability: 'B', value_per_kg: 3.20, hazardous: true },
        { component_name: 'aluminium_chassis', material_designation: 'Aluminium Alloy Chassis', mass_fraction: 0.20, recyclability: 'A', value_per_kg: 1.80, hazardous: false },
        { component_name: 'plastic_parts', material_designation: 'Plastic Components', mass_fraction: 0.10, recyclability: 'C', value_per_kg: 0.10, hazardous: false },
    ],
    plastic_waste: [
        { component_name: 'plastic_resin', material_designation: 'Recyclable Plastic Resin (PET/HDPE/PP)', mass_fraction: 0.92, recyclability: 'A', value_per_kg: 0.38, hazardous: false },
        { component_name: 'label_adhesive', material_designation: 'Label / Adhesive (Residue)', mass_fraction: 0.08, recyclability: 'C', value_per_kg: 0.00, hazardous: false },
    ],
    ewaste: [
        { component_name: 'mixed_metals', material_designation: 'Mixed Metals (Steel / Copper / Aluminium)', mass_fraction: 0.45, recyclability: 'B', value_per_kg: 1.20, hazardous: false },
        { component_name: 'pcb_components', material_designation: 'PCB & Electronic Components', mass_fraction: 0.25, recyclability: 'B', value_per_kg: 2.00, hazardous: true },
        { component_name: 'plastic_housing', material_designation: 'Plastic Housing', mass_fraction: 0.20, recyclability: 'C', value_per_kg: 0.10, hazardous: false },
        { component_name: 'cables_wiring', material_designation: 'Cables & Wiring (Copper core)', mass_fraction: 0.10, recyclability: 'A', value_per_kg: 4.50, hazardous: false },
    ],
};

// ── Live USD → INR exchange rate ─────────────────────────────────────────────
// Uses the free Frankfurter API (https://www.frankfurter.app) — no key required.
// Rate is cached in module memory for 1 hour to avoid per-request API calls.
// Falls back to 84.0 if the network call fails.
const FALLBACK_RATE = 84.0;
let _cachedRate: number = FALLBACK_RATE;
let _cacheExpiry: number = 0;

async function getUsdToInr(): Promise<number> {
    if (Date.now() < _cacheExpiry) return _cachedRate;
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR', { next: { revalidate: 3600 } });
        if (res.ok) {
            const data = await res.json() as { rates: { INR: number } };
            _cachedRate = data.rates.INR;
            _cacheExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
        }
    } catch {
        // network failure — keep using last cached rate or fallback
    }
    return _cachedRate;
}


// Typical masses (kg) for known part classes.
// These replace the VLM's unreliable pixel-based mass estimate so that
// recovery value is consistent across re-scans of the same part type.
const PART_CLASS_MASS_KG: Record<string, number> = {
    // Industrial
    gate_valve: 36,   // DN100 PN16 carbon/SS gate valve
    globe_valve: 28,   // DN80 globe valve
    ball_valve: 18,   // DN50 full-bore ball valve
    butterfly_valve: 14,   // DN150 wafer butterfly valve
    check_valve: 22,   // DN80 swing check valve
    control_valve: 45,   // DN100 pneumatic control valve with actuator
    centrifugal_pump: 85,   // Close-coupled 11 kW centrifugal pump
    gear_pump: 32,   // Small industrial gear pump
    heat_exchanger: 120,   // Shell-and-tube, 1 m² surface area
    pressure_vessel: 200,   // Small pressure vessel / accumulator
    compressor: 180,   // Reciprocating air compressor head
    motor: 42,   // 7.5 kW TEFC induction motor
    circuit_breaker: 8,   // 3-phase MV circuit breaker
    transformer: 95,   // Distribution transformer (small)
    flange: 6,   // DN100 PN16 weld-neck flange pair
    pipe_fitting: 2,   // Elbow / tee fitting
    // E-waste
    battery: 0.07,  // typical 18650 Li-ion cell
    circuit_board: 0.15, // mid-size PCB (e.g. graphics card)
    mobile_device: 0.20, // average smartphone
    peripheral: 0.50,    // keyboard / mouse / drive
    cable_wire: 0.30,    // average cable bundle
    display_screen: 2.5, // 24" monitor
    power_supply: 1.2,   // ATX PSU
    semiconductor_device: 0.01, // individual IC/chip
    // General waste
    plastic_waste: 0.50,
    metal_scrap: 1.0,
    glass_waste: 0.30,
    paper_cardboard: 0.20,
    organic_biodegradable: 0.50,
    hazardous_chemical: 0.80,
    ewaste: 0.80,
    mixed_waste: 1.0,
};

async function buildBOM(payload: PartMetadataPayload, inrRate: number): Promise<BillOfMaterialsEntry[]> {
    const partClass = payload.visual_id.part_class;
    // Prefer canonical part-class mass; fall back to VLM visual estimate, then 1 kg
    const partClassMass = PART_CLASS_MASS_KG[partClass];
    const totalMass = partClassMass ?? payload.geometry_descriptor.estimated_mass_kg ?? 1;

    const toInr = (usd: number) => +(usd * inrRate).toFixed(2);
    const getPriceInr = (materialKey: string, usdFallback: number) => {
        const indiaPrice = indiaScrapPrice(materialKey);
        return indiaPrice !== null ? indiaPrice : toInr(usdFallback);
    };

    // ── Use specific e-waste BOM template if available ──────────────────────
    const ewasteTemplate = EWASTE_BOM_TEMPLATES[partClass];
    if (ewasteTemplate) {
        return ewasteTemplate.map(entry => ({
            component_name: entry.component_name,
            material_designation: entry.material_designation,
            material_standard: undefined,
            alloy_grade: null,
            mass_kg: +(totalMass * entry.mass_fraction).toFixed(3),
            mass_fraction_pct: +(entry.mass_fraction * 100).toFixed(1),
            recyclability_class: entry.recyclability,
            recovery_value_usd_per_kg: toInr(entry.value_per_kg),
            hazardous_substance_content: entry.hazardous,
        }));
    }

    // ── Industrial part BOM ────────────────────────────────────────────────
    if (INDUSTRIAL_PART_CLASSES.has(partClass)) {
        const primaryKey = payload.material_inference.primary_material;
        const secondaryKey = payload.material_inference.secondary_material;
        const primaryInfo = MATERIAL_LOOKUP[primaryKey] ?? DEFAULT_MATERIAL;
        const primaryMass = +(totalMass * primaryInfo.mass_fraction).toFixed(2);

        const bom: BillOfMaterialsEntry[] = [
            {
                component_name: 'primary_body',
                material_designation: primaryInfo.designation,
                material_standard: 'Per OEM specification',
                alloy_grade: payload.material_inference.estimated_alloy_grade ?? null,
                mass_kg: primaryMass,
                mass_fraction_pct: +(primaryInfo.mass_fraction * 100).toFixed(1),
                recyclability_class: primaryInfo.recyclability,
                recovery_value_usd_per_kg: getPriceInr(primaryKey, primaryInfo.value_per_kg),
                hazardous_substance_content: payload.hazard_flags.lead_solder_likelihood,
            },
        ];

        if (secondaryKey) {
            const secondaryInfo = MATERIAL_LOOKUP[secondaryKey];
            if (secondaryInfo) {
                const secondaryMass = +(totalMass * secondaryInfo.mass_fraction).toFixed(2);
                bom.push({
                    component_name: 'secondary_component',
                    material_designation: secondaryInfo.designation,
                    material_standard: undefined,
                    alloy_grade: null,
                    mass_kg: secondaryMass,
                    mass_fraction_pct: +(secondaryInfo.mass_fraction * 100).toFixed(1),
                    recyclability_class: secondaryInfo.recyclability,
                    recovery_value_usd_per_kg: getPriceInr(secondaryKey, secondaryInfo.value_per_kg),
                    hazardous_substance_content: false,
                });
            }
        }

        // Fasteners — only for industrial parts
        const fastenerMass = +(totalMass * 0.04).toFixed(2);
        bom.push({
            component_name: 'fasteners',
            material_designation: 'A2-70 Stainless Steel Bolts',
            material_standard: 'ISO 3506',
            alloy_grade: 'UNS_S30400',
            mass_kg: fastenerMass,
            mass_fraction_pct: 4.0,
            recyclability_class: 'A',
            recovery_value_usd_per_kg: getPriceInr('stainless_steel_CF8M', 1.28),
            hazardous_substance_content: false,
        });

        return bom;
    }

    // ── Unknown item — call AI to generate BOM ─────────────────────────────────
    console.log(`[generate-dpp] Unknown part class "${partClass}" — calling AI BOM generator`);
    const aiBOM = await generateAIBOM(payload, totalMass);
    return aiBOM.entries;
}


function computeWRI(bom: BillOfMaterialsEntry[]): number {
    const gradeScore: Record<string, number> = { A: 1.0, B: 0.6, C: 0.2, UNKNOWN: 0.1 };
    const totalMass = bom.reduce((sum, e) => sum + e.mass_kg, 0);
    const weightedSum = bom.reduce(
        (sum, e) => sum + e.mass_kg * (gradeScore[e.recyclability_class] ?? 0.1),
        0
    );
    return totalMass > 0 ? +((weightedSum / totalMass).toFixed(3)) : 0;
}

function computeRecoveryValue(bom: BillOfMaterialsEntry[]): number {
    return +bom
        .reduce((sum, e) => sum + e.mass_kg * e.recovery_value_usd_per_kg, 0)
        .toFixed(2);
}

function buildMaterialStreams(bom: BillOfMaterialsEntry[]): MaterialStream[] {
    return bom.map((entry, i) => ({
        material: entry.material_designation,
        mass_kg: entry.mass_kg,
        purity_grade: entry.recyclability_class as 'A' | 'B' | 'C',
        destination_bin_id: `BIN-${entry.recyclability_class}-${String(i + 1).padStart(2, '0')}`,
        estimated_spot_value_usd: +(entry.mass_kg * entry.recovery_value_usd_per_kg).toFixed(2),
    }));
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateDppResponse>> {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'generate-dpp',
            limit: 12,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } },
            );
        }

        const body = await request.json() as {
            partPayload: PartMetadataPayload;
            guideResult: GuideResult;
        };
        const { partPayload, guideResult } = body;

        if (!partPayload?.visual_id) {
            return NextResponse.json({ success: false, error: 'Missing partPayload' }, { status: 400 });
        }

        const passportId = `DPP-${new Date().getFullYear()}-${partPayload.visual_id.part_class.toUpperCase().slice(0, 5)}-${uuidv4().slice(0, 8).toUpperCase()}`;
        const now = new Date().toISOString();
        const inrRate = await getUsdToInr();
        const bom = await buildBOM(partPayload, inrRate);
        const wri = computeWRI(bom);
        const totalRecoveryValue = computeRecoveryValue(bom);
        const materialStreams = buildMaterialStreams(bom);

        const dpp: DigitalProductPassport = {
            $schema: 'https://ai-ecotrack.io/schemas/dpp/v2.0.json',
            $id: `urn:ai-ecotrack:dpp:${passportId.toLowerCase()}`,
            schema_version: '2.0.0',

            passport_metadata: {
                passport_id: passportId,
                issued_at: now,
                issuing_entity: 'AI-EcoTrack Platform v1.0',
                last_updated_at: now,
                lifecycle_stage: 'end_of_service',
                regulatory_frameworks: [
                    'EU_ESPR_2024',
                    'REACH',
                    'RoHS_3',
                    'ISO_14067',
                    ...(partPayload.safety_doc_filters ?? []),
                ],
            },

            component_identity: {
                ecotrack_uid: `ECTK-${uuidv4().slice(0, 12).toUpperCase()}`,
                description: `${partPayload.visual_id.part_class.replace(/_/g, ' ')} — ${partPayload.visual_id.subtype ?? 'Standard Type'}`,
                manufacturer_part_number: `${partPayload.visual_id.subtype ?? 'UNKNOWN'}-${partPayload.material_inference.estimated_alloy_grade ?? 'STD'}`,
            },

            material_composition: {
                bill_of_materials: bom,
                total_mass_kg: partPayload.geometry_descriptor.estimated_mass_kg ?? bom.reduce((s, e) => s + e.mass_kg, 0),
                weighted_recyclability_index: wri,
                total_theoretical_recovery_value_usd: totalRecoveryValue,
            },

            service_history: {
                operating_hours: undefined,
                maintenance_events: [],
                failure_codes_recorded: [],
                remaining_useful_life_estimate_hrs: 0,
            },

            disassembly_passport: {
                vlm_identification_event: {
                    scan_timestamp: now,
                    device_id: 'DEVICE-FIELD-001',
                    technician_id: 'TECH-DEMO',
                    vlm_model_version: 'ecotrack-gemini-v1.0',
                    part_confidence_score: partPayload.visual_id.confidence_score,
                    material_confidence_score: partPayload.material_inference.confidence_score,
                    hazard_flags_triggered: Object.entries(partPayload.hazard_flags)
                        .filter(([, v]) => v === true || (typeof v === 'string' && v !== 'none'))
                        .map(([k]) => k),
                    safety_protocols_served: guideResult.safety_protocols,
                },
                recommended_disassembly_sequence: guideResult.disassembly_steps,
            },

            end_of_life_routing: {
                assessment_date: now.slice(0, 10),
                assessed_by_technician: 'TECH-DEMO',
                routing_decision: 'material_recovery',
                routing_rationale: `VLM confidence ${(partPayload.visual_id.confidence_score * 100).toFixed(0)}%. WRI=${wri}. Primary material ${bom[0]?.material_designation} warrants ${bom[0]?.recyclability_class}-class recovery. Estimated recovery value $${totalRecoveryValue.toFixed(2)}.`,
                material_streams: materialStreams,
                total_actual_recovery_value_usd: totalRecoveryValue,
                recovery_efficiency_pct: 100,
            },

            audit_trail: [
                { event: 'passport_created', timestamp: now, actor: 'AI-EcoTrack Platform' },
                { event: 'vlm_scan_completed', timestamp: now, actor: 'TECH-DEMO via DEVICE-FIELD-001' },
                { event: 'disassembly_guide_delivered', timestamp: now, actor: 'AI-EcoTrack RAG Engine v1.0' },
                { event: 'end_of_life_routing_confirmed', timestamp: now, actor: 'System (auto-assessed)' },
            ],

            regulatory_compliance: buildComplianceProfile(
                partPayload.material_inference.primary_material,
                partPayload.material_inference.secondary_material,
            ),
        };

        // ── Persist to Firestore if configured  ──────────────────────────────────
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        if (projectId && projectId !== '') {
            try {
                const { initializeApp, getApps, cert } = await import('firebase-admin/app');
                const { getFirestore } = await import('firebase-admin/firestore');

                if (!getApps().length) {
                    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '{}');
                    if (serviceAccount.project_id) {
                        initializeApp({ credential: cert(serviceAccount) });
                    } else {
                        initializeApp({ projectId });
                    }
                    // settings() MUST be called before any other Firestore method
                    // and only once — so it lives here inside the first-init block.
                    getFirestore().settings({ ignoreUndefinedProperties: true });
                }

                const adminDb = getFirestore();
                await adminDb.collection('passports').doc(passportId).set(dpp);
            } catch (fbErr) {
                // Non-fatal: log and continue
                console.warn('[generate-dpp] Firestore write skipped:', fbErr);
            }
        }

        return NextResponse.json({ success: true, dpp, passport_id: passportId });
    } catch (error) {
        console.error('[generate-dpp] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
