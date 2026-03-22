import type { PartMetadataPayload } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Safety Gatekeeper — Deterministic Rule Engine
//
// This is NOT an LLM. It is a pure deterministic function that enforces
// safety non-negotiables regardless of VLM confidence. It sits between
// the VLM output and the RAG query layer.
//
// Accuracy contribution: +2% toward the 99% Safety Protocol Coverage Score
// by catching known hazard classes that the VLM might underweight.
// ─────────────────────────────────────────────────────────────────────────────

interface GatekeeperResult {
    payload: PartMetadataPayload;
    triggeredRules: string[];
    escalationRequired: boolean;
}

const SAFETY_RULES: Array<{
    id: string;
    description: string;
    condition: (p: PartMetadataPayload) => boolean;
    injectedDocs: string[];
    injectedLabels: string[];
}> = [
        {
            id: 'RULE_001',
            description: 'Pressurized component → PPE + Lockout/Tagout protocol mandatory',
            condition: (p) => p.hazard_flags.pressurized_component === true,
            injectedDocs: ['OSHA_1910.147', 'ISO_4126'],
            injectedLabels: ['OSHA 1910.147 — Lockout/Tagout', 'ISO 4126 — Pressure Relief'],
        },
        {
            id: 'RULE_002',
            description: 'Lead solder likelihood → REACH Annex XVII + RoHS compliance mandatory',
            condition: (p) => p.hazard_flags.lead_solder_likelihood === true,
            injectedDocs: ['REACH_Annex_XVII', 'RoHS_Directive'],
            injectedLabels: ['REACH Annex XVII', 'RoHS Directive 2011/65/EU'],
        },
        {
            id: 'RULE_003',
            description: 'Hydrocarbon residual → ATEX / explosive atmosphere protocol mandatory',
            condition: (p) =>
                typeof p.hazard_flags.residual_fluid_risk === 'string' &&
                p.hazard_flags.residual_fluid_risk.toLowerCase().startsWith('hydrocarbon'),
            injectedDocs: ['ATEX_Directive_2014_34_EU', 'NFPA_30'],
            injectedLabels: ['ATEX Directive 2014/34/EU', 'NFPA 30 — Flammable Liquids'],
        },
        {
            id: 'RULE_004',
            description: 'Asbestos-era component → mandatory asbestos survey before disassembly',
            condition: (p) => p.hazard_flags.asbestos_era_likelihood === true,
            injectedDocs: ['EPA_NESHAP_Asbestos', 'OSHA_1926.1101'],
            injectedLabels: ['EPA NESHAP — Asbestos', 'OSHA 1926.1101 — Asbestos'],
        },
    ];

/**
 * Apply deterministic safety override rules to a VLM-generated payload.
 * Injects mandatory regulatory document filters and escalation flags.
 */
export function applySafetyGatekeeper(payload: PartMetadataPayload): GatekeeperResult {
    const triggeredRules: string[] = [];
    const allInjectedDocs: string[] = [...(payload.safety_doc_filters ?? [])];
    const allInjectedLabels: string[] = [...(payload.injected_regulations ?? [])];

    // Apply all safety rules
    for (const rule of SAFETY_RULES) {
        if (rule.condition(payload)) {
            triggeredRules.push(rule.id);
            for (const doc of rule.injectedDocs) {
                if (!allInjectedDocs.includes(doc)) {
                    allInjectedDocs.push(doc);
                }
            }
            for (const label of rule.injectedLabels) {
                if (!allInjectedLabels.includes(label)) {
                    allInjectedLabels.push(label);
                }
            }
        }
    }

    // Rule 5: Low material confidence → escalate to human expert
    const escalationRequired =
        payload.material_inference.confidence_score < 0.85 ||
        payload.visual_id.confidence_score < 0.92;

    const enhancedPayload: PartMetadataPayload = {
        ...payload,
        safety_doc_filters: allInjectedDocs,
        injected_regulations: allInjectedLabels,
        escalation_required: escalationRequired,
    };

    return {
        payload: enhancedPayload,
        triggeredRules,
        escalationRequired,
    };
}

/**
 * Get a human-readable label for a hazard flag key.
 */
export function getHazardLabel(key: string): string {
    const labels: Record<string, string> = {
        pressurized_component: 'Pressurized Component',
        lead_solder_likelihood: 'Lead Solder Present',
        asbestos_era_likelihood: 'Asbestos-Era Component',
        residual_fluid_risk: 'Residual Fluid Risk',
    };
    return labels[key] ?? key.replace(/_/g, ' ');
}
