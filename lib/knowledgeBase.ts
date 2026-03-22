import type {
    PartMetadataPayload,
    GuideResult,
    DisassemblyStep,
    SourceCitation,
} from '@/types';
import { generateAIGuide } from '@/lib/aiGuideGenerator';

// Lazy-loaded knowledge base (server-side only)
import disassemblyGuides from '@/data/knowledge/disassembly_guides.json';
import safetyRegulations from '@/data/knowledge/safety_regulations.json';
import materialDataSheets from '@/data/knowledge/material_data_sheets.json';

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base Retrieval — RAG Simulation Layer
//
// Production: This queries Pinecone/Weaviate with semantic embeddings.
// Prototype: Metadata-filtered JSON lookup that faithfully replicates
//            the production retrieval architecture without external vector DB.
// ─────────────────────────────────────────────────────────────────────────────


type SafetyRegRecord = {
    id: string;
    title: string;
    standard_body: string;
    applies_to: string[];
    summary: string;
    key_clauses: string[];
};

type GuideRecord = {
    id: string;
    part_class: string;
    material_family: string;
    source: string;
    steps: DisassemblyStep[];
    // DN/pressure class fields (present on size-specific guides)
    dn_min?: number | null;
    dn_max?: number | null;
    pressure_class?: string;
    estimated_mass_kg_range?: [number, number];
    crew_required?: number;
};

// ── DN estimation from mass ───────────────────────────────────────────────────
// Maps estimated_mass_kg → approximate DN nominal diameter for common part classes.
// Used to select the best-fit size-class guide when actual DN is not in the payload.
function estimateDnFromMass(partClass: string, massKg: number): number {
    const cls = partClass.toLowerCase().replace(/[\s-]/g, '_');

    if (cls.includes('ball_valve')) {
        if (massKg <= 8) return 40;    // DN15–50 range
        if (massKg <= 60) return 100;   // DN65–150 range
        return 250;                       // DN200–300
    }
    if (cls.includes('gate_valve')) {
        if (massKg <= 20) return 65;    // DN50–80
        if (massKg <= 100) return 100;   // DN100 (existing guide)
        return 300;                       // DN200–400
    }
    if (cls.includes('globe_valve')) {
        if (massKg <= 12) return 40;    // DN15–50
        return 120;                       // DN80–150
    }
    if (cls.includes('butterfly_valve')) {
        if (massKg <= 120) return 300;   // DN200–400
        return 550;                       // DN450–600
    }
    if (cls.includes('centrifugal_pump') || cls.includes('pump')) {
        // Use mass as proxy for motor kW (rough heuristic)
        if (massKg <= 50) return 40;    // small pump ≤15kW
        return 150;                       // medium pump 15–75kW
    }
    // Generic default
    return massKg <= 30 ? 50 : massKg <= 100 ? 100 : 200;
}

// Known e-waste / general waste part classes and the guide part_class they should match
const EWASTE_CLASS_MAP: Record<string, string> = {
    battery: 'battery',
    pcb: 'circuit_board',
    circuit_board: 'circuit_board',
    mobile_device: 'mobile_device',
    smartphone: 'mobile_device',
    peripheral: 'ewaste',
    cable_wire: 'ewaste',
    display_screen: 'display_screen',
    monitor: 'display_screen',
    screen: 'display_screen',
    lcd: 'display_screen',
    crt: 'display_screen',
    television: 'display_screen',
    storage_device: 'storage_device',
    hard_drive: 'storage_device',
    hdd: 'storage_device',
    ssd: 'storage_device',
    power_supply: 'power_supply',
    smps: 'power_supply',
    ups: 'power_supply',
    charger: 'power_supply',
    adapter: 'power_supply',
    lighting: 'lighting',
    lamp: 'lighting',
    bulb: 'lighting',
    fluorescent: 'lighting',
    cfl: 'lighting',
    led_lamp: 'lighting',
    ev_battery: 'ev_battery',
    hv_battery: 'ev_battery',
    traction_battery: 'ev_battery',
    solar_panel: 'solar_panel',
    pv_panel: 'solar_panel',
    photovoltaic: 'solar_panel',
    control_panel: 'control_panel',
    plc: 'control_panel',
    scada: 'control_panel',
    mcc: 'control_panel',
    hvac: 'hvac',
    air_conditioner: 'hvac',
    refrigerator: 'hvac',
    fridge: 'hvac',
    semiconductor_device: 'circuit_board',
    plastic_waste: 'plastic_waste',
    ewaste: 'ewaste',
    mixed_waste: 'ewaste',
    hazardous_chemical: 'ewaste',
    metal_scrap: 'ewaste',
    glass_waste: 'ewaste',
    paper_cardboard: 'ewaste',
    organic_biodegradable: 'ewaste',
};

/**
 * Retrieve a disassembly guide from the knowledge base.
 *
 * Scoring tiers (highest wins):
 *  1.00 — exact part_class + DN in range + pressure class match
 *  0.90 — exact part_class + DN in range
 *  0.75 — same part_class (generic / any DN)
 *  0.50 — material family fallback
 *  0.30 — first guide (last resort — only for truly unknown items)
 */
function retrieveDisassemblyGuide(payload: PartMetadataPayload): {
    guide: GuideRecord | null;
    citation: SourceCitation | null;
} {
    const partClass = payload.visual_id.part_class.toLowerCase().replace(/[\s-]/g, '_');
    const materialFamily = payload.material_inference.primary_material
        .toLowerCase()
        .replace(/[\s-]/g, '_');

    const estimatedMass = payload.geometry_descriptor?.estimated_mass_kg ?? 30;
    const estimatedDN = estimateDnFromMass(partClass, estimatedMass);

    // Try to extract pressure class hint from subtype string (e.g. "PN40_ball_valve" or "class_300")
    const subtypeRaw = (payload.visual_id.subtype ?? '').toLowerCase();
    const pressureHint = subtypeRaw.includes('pn100') ? 'PN100'
        : subtypeRaw.includes('pn40') ? 'PN40'
            : subtypeRaw.includes('pn16') ? 'PN16'
                : subtypeRaw.includes('600') || subtypeRaw.includes('class600') ? 'PN100'
                    : subtypeRaw.includes('300') || subtypeRaw.includes('class300') ? 'PN40'
                        : null;

    const guides = disassemblyGuides as GuideRecord[];

    // Check if this is a known e-waste type — map to correct guide part_class
    const ewasteGuideClass = EWASTE_CLASS_MAP[partClass];
    if (ewasteGuideClass) {
        const ewasteGuide = guides.find(g => g.part_class === ewasteGuideClass);
        if (ewasteGuide) {
            return {
                guide: ewasteGuide,
                citation: {
                    title: ewasteGuide.source,
                    namespace: 'disassembly_guides',
                    relevance_score: 0.95,
                    standard_id: ewasteGuide.id,
                },
            };
        }
    }

    let bestMatch: GuideRecord | null = null;
    let bestScore = -1;

    for (const g of guides) {
        const classMatch = partClass.includes(g.part_class) || g.part_class.includes(partClass);
        if (!classMatch) continue;

        const hasDnRange = g.dn_min != null && g.dn_max != null;
        const dnInRange = hasDnRange &&
            estimatedDN >= (g.dn_min as number) &&
            estimatedDN <= (g.dn_max as number);
        const pressureMatch = pressureHint != null && g.pressure_class === pressureHint;

        let score: number;
        if (hasDnRange && dnInRange && pressureMatch) score = 1.00;  // Tier 1: perfect match
        else if (hasDnRange && dnInRange) score = 0.90;  // Tier 2: DN match
        else if (!hasDnRange) score = 0.75;  // Tier 3: generic guide
        else score = 0.60;  // Tier 4: wrong DN band but right class

        if (score > bestScore) {
            bestScore = score;
            bestMatch = g;
        }
    }

    // Material family fallback
    if (!bestMatch) {
        bestMatch = guides.find(g => materialFamily.includes(g.material_family)) ?? null;
        if (bestMatch) bestScore = 0.50;
    }

    // Last resort: first guide — but only for truly unknown/industrial items
    // Never use guide[0] (gate valve) for e-waste
    if (!bestMatch && guides.length > 0 && !ewasteGuideClass) {
        bestMatch = guides[0];
        bestScore = 0.30;
    }

    if (!bestMatch) return { guide: null, citation: null };

    return {
        guide: bestMatch,
        citation: {
            title: bestMatch.source,
            namespace: 'disassembly_guides',
            relevance_score: bestScore,
            standard_id: bestMatch.id,
        },
    };
}



type MaterialRecord = {
    id: string;
    material_designation: string;
    material_family: string;
    recyclability_class: string;
    recovery_value_usd_per_kg: number;
    disassembly_notes: string;
};

/**
 * Retrieve mandatory and contextually relevant safety regulations.
 * Safety docs injected by the Gatekeeper are always included (mandatory).
 */
function retrieveSafetyRegulations(payload: PartMetadataPayload): {
    protocols: string[];
    citations: SourceCitation[];
} {
    const mandatoryDocIds = payload.safety_doc_filters ?? [];
    const regulations = safetyRegulations as SafetyRegRecord[];

    const matched: SafetyRegRecord[] = [];

    // Always include gatekeeper-mandated docs first
    for (const docId of mandatoryDocIds) {
        const reg = regulations.find((r) => r.id === docId);
        if (reg && !matched.find((m) => m.id === reg.id)) {
            matched.push(reg);
        }
    }

    // Also add contextually relevant regulations
    const riskKey = payload.hazard_flags?.residual_fluid_risk;
    for (const reg of regulations) {
        if (matched.find((m) => m.id === reg.id)) continue;
        const applies = reg.applies_to.some(
            (a) =>
                riskKey?.includes(a) ||
                (payload.hazard_flags?.pressurized_component && a === 'pressurized_component') ||
                (payload.hazard_flags?.lead_solder_likelihood && a === 'lead_solder_likelihood')
        );
        if (applies) matched.push(reg);
    }

    return {
        protocols: matched.map((r) => r.id),
        citations: matched.map((r) => ({
            title: r.title,
            namespace: 'safety_regulations',
            relevance_score: mandatoryDocIds.includes(r.id) ? 0.99 : 0.85,
            standard_id: r.id,
        })),
    };
}

/**
 * Retrieve material data sheet for the primary identified material.
 */
function retrieveMaterialSheet(payload: PartMetadataPayload): {
    sheet: MaterialRecord | null;
    citation: SourceCitation | null;
} {
    const materialKey = payload.material_inference.primary_material.toLowerCase();
    const sheets = materialDataSheets as MaterialRecord[];

    const match = sheets.find(
        (s) =>
            materialKey.includes(s.material_family) ||
            s.material_designation.toLowerCase().includes(materialKey.split('_')[0])
    );

    if (!match) return { sheet: null, citation: null };

    return {
        sheet: match,
        citation: {
            title: `${match.material_designation} — Material Data Sheet`,
            namespace: 'material_data_sheets',
            relevance_score: 0.94,
            standard_id: match.id,
        },
    };
}

/**
 * Main RAG retrieval entry point.
 * Combines disassembly guide retrieval, safety regulation retrieval,
 * and material data sheet lookup into a unified GuideResult.
 * Falls back to AI-generated guide if no static guide is found.
 */
export async function retrieveGuide(payload: PartMetadataPayload): Promise<GuideResult> {
    const { guide, citation: guideCitation } = retrieveDisassemblyGuide(payload);
    const { protocols, citations: regCitations } = retrieveSafetyRegulations(payload);
    const { citation: matCitation } = retrieveMaterialSheet(payload);

    let steps: DisassemblyStep[];
    let aiGeneratedCitation: SourceCitation | null = null;

    if (guide) {
        steps = guide.steps;
    } else {
        // No static guide found — call AI to generate one
        console.log(`[knowledgeBase] No static guide for "${payload.visual_id.part_class}" — calling AI fallback`);
        const aiGuide = await generateAIGuide(payload);
        steps = aiGuide.steps;
        // Merge AI safety protocols
        for (const p of aiGuide.safety_protocols) {
            if (!protocols.includes(p)) protocols.push(p);
        }
        aiGeneratedCitation = {
            title: 'AI-Generated Guide (Groq/Gemini — not in static knowledge base)',
            namespace: 'ai_generated',
            relevance_score: 0.80,
            standard_id: `ai_guide_${payload.visual_id.part_class}`,
        };
    }

    // Inject safety refs from gatekeeper into first step if not already there
    if (steps.length > 0 && protocols.length > 0 && !steps[0].safety_ref) {
        steps[0] = { ...steps[0], safety_ref: protocols[0] };
    }

    const allCitations: SourceCitation[] = [
        ...(guideCitation ? [guideCitation] : []),
        ...(aiGeneratedCitation ? [aiGeneratedCitation] : []),
        ...regCitations,
        ...(matCitation ? [matCitation] : []),
    ];

    const totalTime = steps.reduce((sum, s) => sum + (s.estimated_time_min ?? 0), 0);

    return {
        disassembly_steps: steps,
        safety_protocols: protocols,
        source_citations: allCitations,
        estimated_total_time_min: totalTime,
    };
}

function getFallbackSteps(): DisassemblyStep[] {
    return [
        {
            step: 1,
            action: 'De-energize and isolate all energy sources. Apply LOTO procedure.',
            tool_required: 'loto_kit',
            safety_ref: 'OSHA_1910.147',
            estimated_time_min: 10,
        },
        {
            step: 2,
            action: 'Drain any residual fluids. Collect in approved container.',
            tool_required: 'drain_kit',
            safety_ref: null,
            estimated_time_min: 15,
        },
        {
            step: 3,
            action: 'Remove fasteners using cross-pattern sequence. Label and store.',
            tool_required: 'wrench_set',
            safety_ref: null,
            estimated_time_min: 20,
        },
        {
            step: 4,
            action: 'Disassemble primary components. Inspect condition. Photograph for DPP record.',
            tool_required: 'camera_and_inspection_tools',
            safety_ref: null,
            estimated_time_min: 25,
        },
        {
            step: 5,
            action: 'Segregate materials into labelled recovery bins by grade (A/B/C).',
            tool_required: null,
            safety_ref: null,
            estimated_time_min: 10,
        },
    ];
}
