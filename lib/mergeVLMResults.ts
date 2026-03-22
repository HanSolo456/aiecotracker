import type { PartMetadataPayload } from '@/types';

/**
 * Merges multiple VLM analysis results from different photo angles
 * into a single high-confidence payload.
 *
 * Merge rules:
 * - visual_id:        pick result with highest visual confidence
 * - material:         pick result with highest material confidence
 * - hazard_flags:     UNION (OR logic) — any angle that flags a hazard keeps it
 * - geometry:         from the highest-confidence visual_id result
 * - confidence boost: annotate that multi-view was used
 */
export function mergeVLMResults(results: PartMetadataPayload[]): PartMetadataPayload {
    if (results.length === 0) throw new Error('No results to merge');
    if (results.length === 1) return results[0];

    // Pick best visual_id
    const bestVisual = results.reduce((best, curr) =>
        curr.visual_id.confidence_score > best.visual_id.confidence_score ? curr : best
    );

    // Pick best material
    const bestMaterial = results.reduce((best, curr) =>
        curr.material_inference.confidence_score > best.material_inference.confidence_score ? curr : best
    );

    // Union hazard flags (OR across all angles)
    const mergedHazards = {
        asbestos_era_likelihood: results.some(r => r.hazard_flags.asbestos_era_likelihood),
        lead_solder_likelihood: results.some(r => r.hazard_flags.lead_solder_likelihood),
        pressurized_component: results.some(r => r.hazard_flags.pressurized_component),
        // For string field, pick the most severe (non-"none", non-"unknown")
        residual_fluid_risk: pickMostSevereFluidRisk(results.map(r => r.hazard_flags.residual_fluid_risk)),
    };

    // Average confidence boost calculation
    const avgVisualConf = results.reduce((s, r) => s + r.visual_id.confidence_score, 0) / results.length;
    const avgMatConf = results.reduce((s, r) => s + r.material_inference.confidence_score, 0) / results.length;

    return {
        ...bestVisual,
        visual_id: {
            ...bestVisual.visual_id,
            // Slight boost when multiple angles agree on same part class
            confidence_score: allAgreeOnPartClass(results)
                ? Math.min(0.99, bestVisual.visual_id.confidence_score + 0.04)
                : bestVisual.visual_id.confidence_score,
        },
        material_inference: {
            ...bestMaterial.material_inference,
            confidence_score: allAgreeOnMaterial(results)
                ? Math.min(0.99, bestMaterial.material_inference.confidence_score + 0.05)
                : bestMaterial.material_inference.confidence_score,
        },
        hazard_flags: mergedHazards,
        // Annotation for the UI to show "Multi-View" badge
        multi_view: {
            angle_count: results.length,
            avg_visual_confidence: Math.round(avgVisualConf * 100) / 100,
            avg_material_confidence: Math.round(avgMatConf * 100) / 100,
            part_class_agreement: allAgreeOnPartClass(results),
            material_agreement: allAgreeOnMaterial(results),
        },
    } as PartMetadataPayload;
}

function allAgreeOnPartClass(results: PartMetadataPayload[]): boolean {
    const classes = results.map(r => r.visual_id.part_class);
    return new Set(classes).size === 1;
}

function allAgreeOnMaterial(results: PartMetadataPayload[]): boolean {
    const materials = results.map(r => r.material_inference.primary_material);
    return new Set(materials).size === 1;
}

const FLUID_RISK_SEVERITY: Record<string, number> = {
    'chemical_likely': 4,
    'hydrocarbon_likely': 3,
    'coolant_likely': 2,
    'unknown': 1,
    'none': 0,
};

function pickMostSevereFluidRisk(risks: string[]): string {
    return risks.reduce((worst, curr) =>
        (FLUID_RISK_SEVERITY[curr] ?? 0) > (FLUID_RISK_SEVERITY[worst] ?? 0) ? curr : worst
        , 'none');
}
