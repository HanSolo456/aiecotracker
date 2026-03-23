import type {
    HandlingSafety,
    PartMetadataPayload,
    SafetyLevel,
    WasteCategory,
    WasteClassification,
} from '@/types';

const INDUSTRIAL_PART_CLASSES = new Set([
    'gate_valve',
    'centrifugal_pump',
    'heat_exchanger',
    'pressure_vessel',
    'motor',
    'compressor',
    'flange',
    'pipe_fitting',
    'circuit_breaker',
    'transformer',
]);

const E_WASTE_CLASSES = new Set([
    'battery',
    'pcb',
    'cable_wire',
    'display_screen',
    'power_supply',
    'semiconductor_device',
    'mobile_device',
    'peripheral',
]);

const CLEAN_RECYCLABLE_CLASSES = new Set([
    'plastic_waste',
    'metal_scrap',
    'glass_waste',
    'paper_cardboard',
]);

const MATERIAL_TO_CATEGORY: Partial<Record<string, WasteCategory>> = {
    organic: 'biodegradable',
    PET: 'recyclable_clean',
    HDPE: 'recyclable_clean',
    glass: 'recyclable_clean',
    paper: 'recyclable_clean',
    FR4_fibreglass: 'recyclable_ewaste',
    silicon: 'recyclable_ewaste',
    lithium_compound: 'recyclable_ewaste',
};

const DEFAULT_RECYCLABILITY: Record<WasteCategory, number> = {
    biodegradable: 68,
    recyclable_clean: 91,
    recyclable_ewaste: 72,
    hazardous: 15,
    industrial_component: 58,
    mixed: 35,
};

const CO2_PER_KG: Partial<Record<WasteCategory, number>> = {
    biodegradable: 0.8,
    recyclable_clean: 2.5,
    recyclable_ewaste: 3.1,
    industrial_component: 2.8,
};

type GuidanceTemplate = {
    citizenLabel: string;
    binLabel: string;
    binColor: string;
    streamLabel: string;
    defaultDropOffLabel: string;
    defaultPrimaryAction: string;
    steps: string[];
    caution: string;
    avoid: string;
};

export interface CitizenWasteGuidance {
    wasteClassification: WasteClassification;
    handlingSafety: HandlingSafety;
    hackathonCategory: 'biodegradable' | 'recyclable' | 'hazardous';
    hackathonLabel: string;
    citizenLabel: string;
    binLabel: string;
    binColor: string;
    streamLabel: string;
    dropOffLabel: string;
    primaryAction: string;
    reason: string;
    steps: string[];
    caution: string;
    avoid: string;
}

export function enrichPayloadForCitizenWasteGuidance(payload: PartMetadataPayload): PartMetadataPayload {
    const wasteClassification = resolveWasteClassification(payload);
    const handlingSafety = resolveHandlingSafety(payload, wasteClassification);

    return {
        ...payload,
        waste_classification: wasteClassification,
        handling_safety: handlingSafety,
        query_intent: 'waste_classification_and_disassembly',
    };
}

const GUIDANCE_BY_CATEGORY: Record<WasteCategory, GuidanceTemplate> = {
    biodegradable: {
        citizenLabel: 'Biodegradable',
        binLabel: 'Green Bin',
        binColor: '#22c55e',
        streamLabel: 'Wet waste / composting',
        defaultDropOffLabel: 'Home compost or municipal wet-waste pickup',
        defaultPrimaryAction: 'Put this in the green wet-waste bin for composting.',
        steps: [
            'Remove any plastic, foil, or non-organic wrapping first.',
            'Keep it with food or garden waste only.',
            'Send it for composting quickly to avoid odour and contamination.',
        ],
        caution: 'Keep biodegradable waste separate from plastic, glass, and metal.',
        avoid: 'Do not place it in the blue recycling stream.',
    },
    recyclable_clean: {
        citizenLabel: 'Recyclable',
        binLabel: 'Blue Bin',
        binColor: '#3b82f6',
        streamLabel: 'Dry recycling',
        defaultDropOffLabel: 'Kerbside dry recycling or scrap recovery point',
        defaultPrimaryAction: 'Place this in the blue dry-waste bin after keeping it clean and dry.',
        steps: [
            'Empty or wipe off any remaining residue.',
            'Keep the item dry so it does not contaminate paper or cardboard.',
            'Place it with other dry recyclables only.',
        ],
        caution: 'A clean and dry item is much more likely to be recycled successfully.',
        avoid: 'Do not mix it with food waste or leaking items.',
    },
    recyclable_ewaste: {
        citizenLabel: 'E-Waste',
        binLabel: 'E-Waste Drop-Off',
        binColor: '#60a5fa',
        streamLabel: 'Authorised e-waste stream',
        defaultDropOffLabel: 'Authorised e-waste collection centre',
        defaultPrimaryAction: 'Keep this out of household bins and route it to an authorised e-waste drop-off.',
        steps: [
            'Store it in a dry place and keep the item intact.',
            'Do not crush, burn, or dismantle it at home.',
            'Hand it over to an authorised e-waste recycler or collection drive.',
        ],
        caution: 'Electronics should be handled through authorised e-waste channels, not mixed recycling.',
        avoid: 'Do not place it in blue or green household bins.',
    },
    hazardous: {
        citizenLabel: 'Hazardous',
        binLabel: 'Red Hazard Bin',
        binColor: '#ef4444',
        streamLabel: 'Hazardous waste handling',
        defaultDropOffLabel: 'Municipal hazardous waste depot or supervised pickup',
        defaultPrimaryAction: 'Do not place this in household bins. Seal it and hand it to a hazardous waste facility.',
        steps: [
            'Avoid direct contact and keep the item upright if it could leak.',
            'Seal it in a sturdy bag or leak-proof container.',
            'Take it to a hazardous waste depot or request supervised pickup.',
        ],
        caution: 'Use gloves and avoid breaking the item open.',
        avoid: 'Do not crush, burn, or mix it with regular waste.',
    },
    industrial_component: {
        citizenLabel: 'Special Handling',
        binLabel: 'Orange Special Stream',
        binColor: '#f59e0b',
        streamLabel: 'Reverse manufacturing / supervised handling',
        defaultDropOffLabel: 'Facility supervisor or industrial collection partner',
        defaultPrimaryAction: 'Keep this out of public bins and route it for supervised industrial handling.',
        steps: [
            'Do not attempt home disassembly or handling without training.',
            'Tag and isolate the item from public recycling bins.',
            'Send it to trained staff for draining, inspection, or reverse manufacturing.',
        ],
        caution: 'Industrial components may retain pressure, oil, or hazardous residue.',
        avoid: 'Do not place it in regular household recycling.',
    },
    mixed: {
        citizenLabel: 'Needs Sorting',
        binLabel: 'Grey Sorting Bin',
        binColor: '#94a3b8',
        streamLabel: 'Manual sorting / rescan',
        defaultDropOffLabel: 'Sorting station or manual review point',
        defaultPrimaryAction: 'Place this in a grey sorting stream until it can be checked again.',
        steps: [
            'Separate obvious food residue or packaging if safe to do so.',
            'Rescan the item or ask for manual review.',
            'Only send it to landfill after sorting options are exhausted.',
        ],
        caution: 'If the item leaks or smells chemical, treat it as hazardous instead.',
        avoid: 'Do not guess between green and blue bins when the item is unclear.',
    },
};

function roundToWholeNumber(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}

function titleCase(value: string): string {
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferWasteCategory(payload: PartMetadataPayload): WasteCategory {
    const existing = payload.waste_classification?.waste_category;
    const partClass = payload.visual_id.part_class;
    const material = payload.material_inference.primary_material;
    const fluidRisk = payload.hazard_flags.residual_fluid_risk;
    const hasSevereContamination =
        fluidRisk === 'chemical_likely' || fluidRisk === 'battery_electrolyte';
    const hasModerateContamination =
        fluidRisk === 'hydrocarbon_likely' || fluidRisk === 'coolant_likely';

    if (existing === 'hazardous' || payload.hazard_flags.asbestos_era_likelihood || hasSevereContamination) {
        return 'hazardous';
    }

    if (partClass === 'hazardous_chemical') {
        return 'hazardous';
    }

    if (partClass === 'organic_biodegradable' || MATERIAL_TO_CATEGORY[material] === 'biodegradable') {
        return 'biodegradable';
    }

    if (INDUSTRIAL_PART_CLASSES.has(partClass) || payload.hazard_flags.pressurized_component) {
        return 'industrial_component';
    }

    if (existing === 'recyclable_ewaste' || E_WASTE_CLASSES.has(partClass)) {
        return hasModerateContamination ? 'hazardous' : 'recyclable_ewaste';
    }

    if (existing === 'recyclable_clean' || CLEAN_RECYCLABLE_CLASSES.has(partClass)) {
        return hasModerateContamination ? 'hazardous' : 'recyclable_clean';
    }

    if (existing) {
        return existing;
    }

    if (MATERIAL_TO_CATEGORY[material]) {
        return MATERIAL_TO_CATEGORY[material] as WasteCategory;
    }

    if (partClass === 'mixed_waste' || partClass === 'unknown') {
        return 'mixed';
    }

    return 'mixed';
}

function inferRecommendedStream(category: WasteCategory): string {
    switch (category) {
        case 'biodegradable':
            return 'Composting';
        case 'recyclable_clean':
            return 'Kerbside recycling';
        case 'recyclable_ewaste':
            return 'Authorised e-waste facility';
        case 'hazardous':
            return 'Hazardous waste depot';
        case 'industrial_component':
            return 'Reverse manufacturing';
        case 'mixed':
        default:
            return 'Manual sorting';
    }
}

function inferCo2Saving(payload: PartMetadataPayload, category: WasteCategory): number | null {
    const rate = CO2_PER_KG[category];
    if (!rate) return null;
    const estimatedMass = payload.geometry_descriptor.estimated_mass_kg ?? 0.5;
    return roundToOneDecimal(estimatedMass * rate);
}

export function resolveWasteClassification(payload: PartMetadataPayload): WasteClassification {
    const category = inferWasteCategory(payload);
    const existing = payload.waste_classification;

    return {
        waste_category: category,
        recyclability_score: roundToWholeNumber(
            typeof existing?.recyclability_score === 'number'
                ? existing.recyclability_score
                : DEFAULT_RECYCLABILITY[category]
        ),
        recommended_stream: existing?.recommended_stream || inferRecommendedStream(category),
        co2_saving_kg:
            typeof existing?.co2_saving_kg === 'number'
                ? roundToOneDecimal(existing.co2_saving_kg)
                : inferCo2Saving(payload, category),
    };
}

function inferSafetyLevel(payload: PartMetadataPayload, wasteClassification: WasteClassification): SafetyLevel {
    const existing = payload.handling_safety?.safety_level;
    const fluidRisk = payload.hazard_flags.residual_fluid_risk;

    if (
        existing === 'danger' ||
        wasteClassification.waste_category === 'hazardous' ||
        payload.hazard_flags.asbestos_era_likelihood ||
        fluidRisk === 'chemical_likely' ||
        fluidRisk === 'battery_electrolyte'
    ) {
        return 'danger';
    }

    if (
        existing === 'caution' ||
        wasteClassification.waste_category === 'industrial_component' ||
        payload.hazard_flags.pressurized_component ||
        payload.hazard_flags.lead_solder_likelihood ||
        fluidRisk === 'hydrocarbon_likely' ||
        fluidRisk === 'coolant_likely' ||
        wasteClassification.waste_category === 'recyclable_ewaste'
    ) {
        return 'caution';
    }

    return 'safe';
}

function inferPPE(payload: PartMetadataPayload, safetyLevel: SafetyLevel): string[] {
    if (payload.handling_safety?.ppe_required?.length) {
        return payload.handling_safety.ppe_required;
    }

    if (safetyLevel === 'danger') {
        const ppe = ['nitrile_gloves', 'safety_goggles', 'face_mask'];
        if (
            payload.hazard_flags.asbestos_era_likelihood ||
            payload.hazard_flags.residual_fluid_risk === 'chemical_likely'
        ) {
            ppe.push('respirator');
        }
        if (payload.hazard_flags.residual_fluid_risk === 'chemical_likely') {
            ppe.push('full_PPE_suit');
        }
        return ppe;
    }

    if (safetyLevel === 'caution') {
        const ppe = ['nitrile_gloves'];
        if (
            payload.hazard_flags.pressurized_component ||
            payload.hazard_flags.residual_fluid_risk === 'hydrocarbon_likely' ||
            payload.hazard_flags.residual_fluid_risk === 'coolant_likely'
        ) {
            ppe.push('safety_goggles');
        }
        if (payload.hazard_flags.lead_solder_likelihood) {
            ppe.push('face_mask');
        }
        return ppe;
    }

    return [];
}

function inferSafetyReason(payload: PartMetadataPayload, wasteClassification: WasteClassification, safetyLevel: SafetyLevel): string {
    if (payload.handling_safety?.reason) {
        return payload.handling_safety.reason;
    }

    if (payload.hazard_flags.asbestos_era_likelihood) {
        return 'Possible asbestos-containing material detected. Avoid direct handling and route for specialist disposal.';
    }

    switch (payload.hazard_flags.residual_fluid_risk) {
        case 'chemical_likely':
            return 'Chemical residue was detected, so this item needs hazardous waste handling.';
        case 'battery_electrolyte':
            return 'Battery leakage was detected, so the item must go to a hazardous handling stream.';
        case 'hydrocarbon_likely':
            return 'Oil or hydrocarbon residue was detected. Keep the item out of standard recycling until it is handled safely.';
        case 'coolant_likely':
            return 'Coolant residue was detected. Route the item through supervised handling instead of household recycling.';
        default:
            break;
    }

    if (wasteClassification.waste_category === 'industrial_component') {
        return 'This looks like an industrial component and should be handled through supervised reverse-manufacturing flow.';
    }

    if (wasteClassification.waste_category === 'recyclable_ewaste') {
        return 'Electronic material was detected, so this should be routed to an authorised e-waste recycler.';
    }

    if (wasteClassification.waste_category === 'biodegradable') {
        return 'Organic material was detected, so composting is the preferred route.';
    }

    if (wasteClassification.waste_category === 'recyclable_clean') {
        return 'The item appears dry and recyclable with no major hazard flags detected.';
    }

    if (wasteClassification.waste_category === 'mixed') {
        return 'The scan could not confidently assign a safe stream, so manual sorting is recommended.';
    }

    return safetyLevel === 'safe'
        ? 'Standard handling is suitable for this item.'
        : 'Use care and follow the recommended handling stream for this item.';
}

export function resolveHandlingSafety(
    payload: PartMetadataPayload,
    wasteClassification = resolveWasteClassification(payload),
): HandlingSafety {
    const safetyLevel = inferSafetyLevel(payload, wasteClassification);

    return {
        safety_level: safetyLevel,
        reason: inferSafetyReason(payload, wasteClassification, safetyLevel),
        ppe_required: inferPPE(payload, safetyLevel),
    };
}

function buildCitizenReason(
    payload: PartMetadataPayload,
    wasteClassification: WasteClassification,
    handlingSafety: HandlingSafety,
): string {
    if (wasteClassification.waste_category === 'hazardous') {
        return handlingSafety.reason;
    }

    if (wasteClassification.waste_category === 'industrial_component') {
        return 'This item belongs in a supervised collection stream, not a public bin.';
    }

    if (wasteClassification.waste_category === 'recyclable_ewaste' && payload.hazard_flags.lead_solder_likelihood) {
        return 'It looks like electronic waste, so it should go to an authorised e-waste channel instead of mixed recycling.';
    }

    return handlingSafety.reason;
}

function resolveHackathonCategory(
    wasteClassification: WasteClassification,
    handlingSafety: HandlingSafety,
): 'biodegradable' | 'recyclable' | 'hazardous' {
    if (wasteClassification.waste_category === 'biodegradable') {
        return 'biodegradable';
    }

    if (
        wasteClassification.waste_category === 'hazardous' ||
        handlingSafety.safety_level === 'danger'
    ) {
        return 'hazardous';
    }

    return 'recyclable';
}

function buildSteps(
    category: WasteCategory,
    payload: PartMetadataPayload,
    handlingSafety: HandlingSafety,
): string[] {
    const templateSteps = [...GUIDANCE_BY_CATEGORY[category].steps];

    if (category === 'recyclable_ewaste' && payload.visual_id.part_class === 'battery') {
        templateSteps.unshift('If the battery is removable, keep terminals covered and store it separately.');
    }

    if (category === 'hazardous' && payload.hazard_flags.residual_fluid_risk === 'battery_electrolyte') {
        templateSteps[0] = 'Keep the leaking item upright and away from heat, flame, and direct touch.';
    }

    if (category === 'hazardous' && payload.hazard_flags.asbestos_era_likelihood) {
        templateSteps[0] = 'Do not disturb or break the material, because fibres may become airborne.';
    }

    if (handlingSafety.safety_level === 'caution' && !templateSteps[0].toLowerCase().includes('gloves')) {
        templateSteps.unshift('Use gloves before moving the item into the recommended stream.');
    }

    return templateSteps.slice(0, 4);
}

export function buildCitizenWasteGuidance(payload: PartMetadataPayload): CitizenWasteGuidance {
    const enrichedPayload = enrichPayloadForCitizenWasteGuidance(payload);
    const wasteClassification = enrichedPayload.waste_classification as WasteClassification;
    const handlingSafety = enrichedPayload.handling_safety as HandlingSafety;
    const hackathonCategory = resolveHackathonCategory(wasteClassification, handlingSafety);
    const template = GUIDANCE_BY_CATEGORY[wasteClassification.waste_category];
    const partLabel = titleCase(enrichedPayload.visual_id.part_class);

    return {
        wasteClassification,
        handlingSafety,
        hackathonCategory,
        hackathonLabel:
            hackathonCategory === 'biodegradable'
                ? 'Biodegradable'
                : hackathonCategory === 'hazardous'
                    ? 'Hazardous'
                    : 'Recyclable',
        citizenLabel: template.citizenLabel,
        binLabel: template.binLabel,
        binColor: template.binColor,
        streamLabel: wasteClassification.recommended_stream || template.streamLabel,
        dropOffLabel: template.defaultDropOffLabel,
        primaryAction:
            wasteClassification.waste_category === 'mixed' && enrichedPayload.visual_id.part_class !== 'unknown'
                ? `Sort or rescan this ${partLabel.toLowerCase()} before disposal.`
                : template.defaultPrimaryAction,
        reason: buildCitizenReason(enrichedPayload, wasteClassification, handlingSafety),
        steps: buildSteps(wasteClassification.waste_category, enrichedPayload, handlingSafety),
        caution: template.caution,
        avoid: template.avoid,
    };
}
