import type { PartMetadataPayload } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock VLM Payload — Gate Valve (from Technical Specification)
// Used when GEMINI_API_KEY is not set, ensuring the demo never breaks.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_PART_PAYLOAD: PartMetadataPayload = {
    visual_id: {
        part_class: 'gate_valve',
        subtype: 'wedge_gate_DN100',
        confidence_score: 0.96,
        bounding_box: [0.12, 0.08, 0.88, 0.91],
    },
    material_inference: {
        primary_material: '316L_stainless_steel',
        secondary_material: 'PTFE_seat_ring',
        confidence_score: 0.91,
        surface_condition: 'moderate_corrosion_grade_2',
        estimated_alloy_grade: 'UNS_S31603',
    },
    hazard_flags: {
        asbestos_era_likelihood: false,
        lead_solder_likelihood: false,
        pressurized_component: true,
        residual_fluid_risk: 'hydrocarbon_likely',
    },
    geometry_descriptor: {
        nominal_size_mm: 100,
        connection_type: 'flanged_ANSI_B16.5',
        estimated_mass_kg: 14.2,
    },
    waste_classification: {
        waste_category: 'industrial_component',
        recyclability_score: 58,
        recommended_stream: 'Reverse manufacturing',
        co2_saving_kg: 39.8,
    },
    handling_safety: {
        safety_level: 'caution',
        reason: 'This industrial component may retain fluid residue and should be routed through supervised handling.',
        ppe_required: ['nitrile_gloves', 'safety_goggles'],
    },
    query_intent: 'waste_classification_and_disassembly',
    fallback_required: false,
};

// Alternative mock: Centrifugal pump (for variety in demos)
export const MOCK_PUMP_PAYLOAD: PartMetadataPayload = {
    visual_id: {
        part_class: 'centrifugal_pump',
        subtype: 'end_suction_ANSI_B73',
        confidence_score: 0.94,
        bounding_box: [0.05, 0.1, 0.95, 0.9],
    },
    material_inference: {
        primary_material: 'stainless_steel_CF8M',
        secondary_material: 'silicon_carbide_seal',
        confidence_score: 0.88,
        surface_condition: 'minor_wear_within_tolerance',
        estimated_alloy_grade: 'ASTM_A890',
    },
    hazard_flags: {
        asbestos_era_likelihood: false,
        lead_solder_likelihood: false,
        pressurized_component: true,
        residual_fluid_risk: 'none',
    },
    geometry_descriptor: {
        nominal_size_mm: 150,
        connection_type: 'flanged_ANSI_B73',
        estimated_mass_kg: 42.0,
    },
    waste_classification: {
        waste_category: 'industrial_component',
        recyclability_score: 61,
        recommended_stream: 'Reverse manufacturing',
        co2_saving_kg: 117.6,
    },
    handling_safety: {
        safety_level: 'caution',
        reason: 'Industrial pumps can retain pressure and should be isolated before handling.',
        ppe_required: ['nitrile_gloves', 'safety_goggles'],
    },
    query_intent: 'waste_classification_and_disassembly',
    fallback_required: false,
};
