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
import partClassAliasesRaw from '@/data/knowledge/part_class_aliases.json';

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base Retrieval — RAG Layer
//
// v2 upgrades over v1:
//   1. Alias expansion  — 100+ common names → canonical part_class before lookup
//   2. Firestore cache  — AI-generated guides are persisted and re-used (30-day TTL)
//   3. Richer citations — alias-hit flag surfaced in citation metadata
//
// Production path: swap static JSON retrieval for vector embedding search
// against Pinecone / Weaviate using the same GuideResult interface.
// ─────────────────────────────────────────────────────────────────────────────

// ── Alias map ────────────────────────────────────────────────────────────────
const PART_CLASS_ALIASES: Record<string, string> =
    (partClassAliasesRaw as { aliases: Record<string, string> }).aliases;

/**
 * Resolve a raw VLM part_class to its canonical form using the alias map.
 * Returns the original value unchanged if no alias is found.
 */
function resolveAlias(partClass: string): { resolved: string; aliasUsed: boolean } {
    const key = partClass.toLowerCase().replace(/[\s-]/g, '_');
    const resolved = PART_CLASS_ALIASES[key];
    if (resolved) return { resolved, aliasUsed: true };
    return { resolved: key, aliasUsed: false };
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
    aliasUsed: boolean;
} {
    // ── Step 1: alias resolution ──────────────────────────────────────────────
    const rawPartClass = payload.visual_id.part_class.toLowerCase().replace(/[\s-]/g, '_');
    const { resolved: partClass, aliasUsed } = resolveAlias(rawPartClass);

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

    // ── Step 2: e-waste class map ──────────────────────────────────────────────
    const ewasteGuideClass = EWASTE_CLASS_MAP[partClass];
    if (ewasteGuideClass) {
        const ewasteGuide = guides.find(g => g.part_class === ewasteGuideClass);
        if (ewasteGuide) {
            return {
                guide: ewasteGuide,
                aliasUsed,
                citation: {
                    title: ewasteGuide.source,
                    namespace: 'disassembly_guides',
                    relevance_score: aliasUsed ? 0.90 : 0.95,
                    standard_id: ewasteGuide.id,
                },
            };
        }
    }

    // ── Step 3: scored lookup ──────────────────────────────────────────────────
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

    if (!bestMatch) return { guide: null, citation: null, aliasUsed };

    return {
        guide: bestMatch,
        aliasUsed,
        citation: {
            title: bestMatch.source,
            namespace: 'disassembly_guides',
            relevance_score: aliasUsed ? Math.max(bestScore - 0.05, 0.25) : bestScore,
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

// ── Firestore guide cache ────────────────────────────────────────────────────
// AI-generated guides are persisted for 30 days to avoid redundant API calls.
// Reading uses the Firebase Admin SDK (server-side only).

const AI_GUIDE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type CachedAIGuide = {
    steps: DisassemblyStep[];
    safety_protocols: string[];
    generatedAt: number; // Unix ms
    part_class: string;
};

/**
 * Try to load an AI-generated guide from Firestore (server-side only).
 * Returns null if not found or expired.
 */
async function getAIGuideFromCache(partClass: string): Promise<CachedAIGuide | null> {
    try {
        // Dynamic import to avoid bundling Admin SDK on the client
        const { getFirestore } = await import('firebase-admin/firestore');
        const db = getFirestore();
        const docRef = db.collection('ai_guides').doc(partClass);
        const snap = await docRef.get();

        if (!snap.exists) return null;

        const data = snap.data() as CachedAIGuide;
        const age = Date.now() - (data.generatedAt ?? 0);
        if (age > AI_GUIDE_TTL_MS) {
            console.log(`[knowledgeBase] Cache EXPIRED for "${partClass}" (age: ${Math.round(age / 86400000)}d) — regenerating`);
            return null;
        }

        console.log(`[knowledgeBase] Cache HIT for "${partClass}"`);
        return data;
    } catch (err) {
        // Non-fatal: if Admin SDK isn't initialised (e.g. local dev without service account), skip cache
        console.warn('[knowledgeBase] Firestore cache read skipped:', (err as Error).message);
        return null;
    }
}

/**
 * Persist an AI-generated guide to Firestore so future scans skip the API call.
 */
async function saveAIGuideToCache(
    partClass: string,
    steps: DisassemblyStep[],
    safety_protocols: string[],
): Promise<void> {
    try {
        const { getFirestore } = await import('firebase-admin/firestore');
        const db = getFirestore();
        const payload: CachedAIGuide = {
            part_class: partClass,
            steps,
            safety_protocols,
            generatedAt: Date.now(),
        };
        await db.collection('ai_guides').doc(partClass).set(payload);
        console.log(`[knowledgeBase] Cached AI guide for "${partClass}"`);
    } catch (err) {
        // Non-fatal — cache miss on next scan is better than a broken scan pipeline
        console.warn('[knowledgeBase] Firestore cache write skipped:', (err as Error).message);
    }
}

/**
 * Main RAG retrieval entry point.
 * Combines disassembly guide retrieval, safety regulation retrieval,
 * and material data sheet lookup into a unified GuideResult.
 *
 * Retrieval order:
 *  1. Static knowledge base (exact / scored match)
 *  2. Firestore AI guide cache (30-day TTL)
 *  3. Live AI generation via Groq/Gemini → persisted to cache
 */
export async function retrieveGuide(payload: PartMetadataPayload): Promise<GuideResult> {
    const { guide, citation: guideCitation, aliasUsed } = retrieveDisassemblyGuide(payload);
    const { protocols, citations: regCitations } = retrieveSafetyRegulations(payload);
    const { citation: matCitation } = retrieveMaterialSheet(payload);

    let steps: DisassemblyStep[];
    const extraCitations: SourceCitation[] = [];

    if (guide) {
        steps = guide.steps;

        // Surface alias expansion in citations for transparency
        if (aliasUsed && guideCitation) {
            extraCitations.push({
                title: `Alias match: "${payload.visual_id.part_class}" → "${guide.part_class}"`,
                namespace: 'alias_expansion',
                relevance_score: 0.88,
                standard_id: `alias_${payload.visual_id.part_class}`,
            });
        }
    } else {
        // No static guide — check Firestore cache first
        const cacheKey = payload.visual_id.part_class.toLowerCase().replace(/[\s-]/g, '_');
        const cached = await getAIGuideFromCache(cacheKey);

        if (cached) {
            steps = cached.steps;
            for (const p of cached.safety_protocols) {
                if (!protocols.includes(p)) protocols.push(p);
            }
            extraCitations.push({
                title: 'AI-Generated Guide (cached — Groq/Gemini)',
                namespace: 'ai_generated_cached',
                relevance_score: 0.82,
                standard_id: `ai_guide_cached_${cacheKey}`,
            });
        } else {
            // No cache hit — call AI and persist the result
            console.log(`[knowledgeBase] No static guide for "${payload.visual_id.part_class}" — calling AI`);
            const aiGuide = await generateAIGuide(payload);
            steps = aiGuide.steps;

            for (const p of aiGuide.safety_protocols) {
                if (!protocols.includes(p)) protocols.push(p);
            }

            // Persist for future scans (fire-and-forget, non-blocking)
            void saveAIGuideToCache(cacheKey, steps, aiGuide.safety_protocols);

            extraCitations.push({
                title: 'AI-Generated Guide (Groq/Gemini — not in static knowledge base)',
                namespace: 'ai_generated',
                relevance_score: 0.80,
                standard_id: `ai_guide_${payload.visual_id.part_class}`,
            });
        }
    }

    // Inject safety refs from gatekeeper into first step if not already there
    if (steps.length > 0 && protocols.length > 0 && !steps[0].safety_ref) {
        steps[0] = { ...steps[0], safety_ref: protocols[0] };
    }

    const allCitations: SourceCitation[] = [
        ...(guideCitation ? [guideCitation] : []),
        ...extraCitations,
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
