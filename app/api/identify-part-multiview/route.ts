import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqWithFallback } from '@/lib/groqClient';
import { applySafetyGatekeeper } from '@/lib/safetyGatekeeper';
import { mergeVLMResults } from '@/lib/mergeVLMResults';
import { MOCK_PART_PAYLOAD } from '@/lib/mockData';
import { enrichPayloadForCitizenWasteGuidance } from '@/lib/wasteGuidance';
import { checkRateLimit } from '@/lib/requestRateLimit';
import type { PartMetadataPayload, IdentifyPartResponse } from '@/types';

// Extend Next.js route timeout to 90s to accommodate slow vision model responses
export const maxDuration = 90;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify-part-multiview
//
// Accepts: { images: [{ imageBase64: string, mimeType: string }] }  (1–3 images)
// Returns: IdentifyPartResponse with merged payload + multi_view annotation
//
// Covers: Industrial parts, PCBs, e-waste, and general waste categories
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a strict JSON waste classification engine for AI-EcoTrack — a Circular Waste Intelligence Platform. You analyse images of waste items, industrial components, electronics, and batteries to classify them for responsible recycling, disassembly, or disposal. You MUST return ONLY a valid raw JSON object. Do NOT include <think> tags, reasoning, markdown fences, or conversational text. Start directly with { and end with }.`;

const USER_PROMPT = `Carefully analyse the image and return ONLY raw JSON matching the exact schema below. Every field must be based on what you can VISUALLY OBSERVE in the image — do NOT assume worst-case defaults.

CLASSIFICATION SCOPE — you must identify items from ALL of these categories:

ELECTRONIC & E-WASTE:
- battery (lithium-ion, lithium-polymer / LiPo pouch cells, RC batteries with XT60/JST connectors, 18650 cells, lead-acid, NiMH, alkaline)
- pcb (printed circuit boards, motherboards, graphics cards, RAM sticks)
- cable_wire (power cables, ethernet, USB, coaxial, wiring harness, battery leads)
- display_screen (CRT, LCD, OLED panels, monitors, phone screens)
- power_supply (PSUs, SMPS, transformers, adapters, chargers)
- semiconductor_device (ICs, processors, chips, sensors, microcontrollers)
- mobile_device (smartphones, tablets, feature phones)
- peripheral (keyboard, mouse, hard drive, SSD, optical drive)

INDUSTRIAL COMPONENTS:
- gate_valve | centrifugal_pump | heat_exchanger | pressure_vessel
- motor | compressor | flange | pipe_fitting
- circuit_breaker | transformer

GENERAL WASTE:
- plastic_waste (PET bottles, HDPE containers, packaging, mixed plastic)
- metal_scrap (steel, aluminium, copper scrap, cans)
- glass_waste (bottles, jars, broken glass)
- paper_cardboard (boxes, newspapers, office paper)
- organic_biodegradable (food waste, garden waste, compostable material)
- hazardous_chemical (paint cans, solvents, pesticides, chemical containers)
- mixed_waste (unsorted or unclear waste stream)
- unknown

WASTE CATEGORY RULES:
waste_category:
- "biodegradable": organic_biodegradable, natural fibre, food waste
- "recyclable_clean": plastic_waste, metal_scrap, glass_waste, paper_cardboard, intact PCBs, clean cable
- "recyclable_ewaste": pcb, battery (intact), semiconductor_device, mobile_device, display_screen, power_supply, peripheral
- "hazardous": battery (damaged/swollen/lipo), hazardous_chemical, CRT screens, mercury-containing items, items with visible chemical contamination
- "industrial_component": valves, pumps, motors, pressure vessels — follow reverse manufacturing protocol
- "mixed": unsorted, unclear

HAZARD FLAG RULES:
residual_fluid_risk:
- "battery_electrolyte": lithium battery, swollen cell, electrolyte residue
- "hydrocarbon_likely": visible oil stains, dark grease, petroleum residue
- "chemical_likely": chemical discolouration, crystalline chemical deposits, acid burn marks
- "coolant_likely": green/blue/orange coolant staining
- "none": dry, clean surface
- "unknown": too blurry to determine

pressurized_component: true for valves, pumps, pressure vessels, pipe fittings. false for electronics, batteries, general waste.

asbestos_era_likelihood: true ONLY for fibrous pipe lagging, degraded industrial insulation.

lead_solder_likelihood: true for PCBs, solder joints, old electronics (pre-2006 RoHS). Also true for CRT monitors.

{
  "visual_id": {
    "part_class": "<see full list above>",
    "subtype": "<specific subtype e.g. '3S LiPo Battery with XT60 Connector', 'FR4 PCB with BGA chips', 'lithium-ion 18650', 'HDPE bottle', or null>",
    "confidence_score": <0.0–1.0>,
    "bounding_box": [0.0, 0.0, 1.0, 1.0]
  },
  "waste_classification": {
    "waste_category": "<biodegradable|recyclable_clean|recyclable_ewaste|hazardous|industrial_component|mixed>",
    "recyclability_score": <0–100, where 100 = fully recyclable with current technology>,
    "recommended_stream": "<e.g. 'Authorised E-Waste & Battery Drop-Off', 'Kerbside recycling', 'Composting', 'Hazardous waste depot', 'Reverse manufacturing'>",
    "co2_saving_kg": <estimated kg CO2 saved by correct disposal vs landfill, or null>
  },
  "material_inference": {
    "primary_material": "<316L_stainless_steel|carbon_steel|cast_iron|copper_alloy|titanium|aluminium_alloy|PTFE|FR4_fibreglass|silicon|lithium_compound|polypropylene|PET|HDPE|glass|paper|organic|unknown>",
    "secondary_material": "<secondary or null>",
    "confidence_score": <0.0–1.0>,
    "surface_condition": "<clean|minor_wear|moderate_corrosion_grade_2|heavy_corrosion|damaged|swollen|unknown>",
    "estimated_alloy_grade": "<UNS/AISI grade if determinable, or null>"
  },
  "hazard_flags": {
    "asbestos_era_likelihood": <true|false>,
    "lead_solder_likelihood": <true|false>,
    "pressurized_component": <true|false>,
    "residual_fluid_risk": "<hydrocarbon_likely|chemical_likely|coolant_likely|battery_electrolyte|none|unknown>"
  },
  "handling_safety": {
    "safety_level": "<danger|caution|safe>",
    "reason": "<one plain-English sentence explaining why — e.g. 'Lithium polymer battery with thermal runaway and fire risk; insulate connectors.' or 'Clean recyclable plastic, no hazardous materials detected.'>",
    "ppe_required": ["<list only what is needed e.g. 'nitrile_gloves', 'face_mask', 'safety_goggles', 'insulated_gloves', or empty array []>"]
  },
  "geometry_descriptor": {
    "nominal_size_mm": <estimated mm or null>,
    "connection_type": "<flanged_ANSI_B16.5|threaded_NPT|welded|socket_weld|USB|PCIe|XT60|JST|null>",
    "estimated_mass_kg": <number or null>
  },
  "query_intent": "waste_classification_and_disassembly",
  "fallback_required": false
}

HANDLING SAFETY RULES — set safety_level based on these:
- "danger": lithium batteries / leaking battery / chemical container / CRT screen / asbestos / unknown liquid contamination.
- "caution": PCBs with solder / pressurized components / hydrocarbon residue / industrial parts requiring lockout-tagout / items needing gloves.
- "safe": clean plastics / paper / glass / organic waste / dry intact electronics with no leakage or solder exposure risk.

If overall confidence < 0.5, set fallback_required to true and part_class to "unknown".`;

function extractJSON(text: string): PartMetadataPayload {
    // 1. Remove thinking / reasoning tags from models like Qwen 3.6
    let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // 2. Remove markdown code blocks
    clean = clean.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // 3. Match JSON object
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return JSON.parse(match[0]) as PartMetadataPayload;
}

const UNKNOWN_INCONCLUSIVE_PAYLOAD: PartMetadataPayload = {
    visual_id: {
        part_class: 'unknown',
        subtype: 'unidentified_item',
        confidence_score: 0.3,
        bounding_box: [0.0, 0.0, 1.0, 1.0],
    },
    material_inference: {
        primary_material: 'unknown',
        confidence_score: 0.2,
        surface_condition: 'unknown',
    },
    hazard_flags: {
        asbestos_era_likelihood: false,
        lead_solder_likelihood: false,
        pressurized_component: false,
        residual_fluid_risk: 'unknown',
    },
    geometry_descriptor: {
        estimated_mass_kg: 0.5,
    },
    waste_classification: {
        waste_category: 'mixed',
        recyclability_score: 40,
        recommended_stream: 'Manual Inspection / General Sorting',
        co2_saving_kg: 0.5,
    },
    handling_safety: {
        safety_level: 'caution',
        reason: 'AI classification was inconclusive. Please inspect manually with protective gloves.',
        ppe_required: ['nitrile_gloves', 'safety_goggles'],
    },
    query_intent: 'waste_classification_and_disassembly',
    fallback_required: true,
};

/** Rejects after `ms` milliseconds with a timeout error */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms)
        ),
    ]);
}

async function analyseOne(b64: string, mimeType: string): Promise<PartMetadataPayload> {
    const geminiKey = process.env.GEMINI_API_KEY;
    const hasGroqKey = !!(process.env.GROQ_API_KEY_1 ?? process.env.GROQ_API_KEY);

    // ── Gemini primary (model cascade) ───────────────────────────────────────
    if (geminiKey) {
        const genAI = new GoogleGenerativeAI(geminiKey);
        // Try models in order — if one hangs or isn't on the tier, move to the next
        const geminiModels = [
            { id: 'gemini-3.5-flash', timeout: 35_000 },
            { id: 'gemini-2.0-flash', timeout: 50_000 },
        ];
        for (const { id, timeout } of geminiModels) {
            try {
                const model = genAI.getGenerativeModel({ model: id });
                const result = await withTimeout(
                    model.generateContent([
                        `${SYSTEM_PROMPT}\n\n${USER_PROMPT}`,
                        { inlineData: { data: b64, mimeType } },
                    ]),
                    timeout,
                    id
                );
                console.log(`[multiview] Provider: ${id} ✓`);
                return extractJSON(result.response.text().trim());
            } catch (e) {
                console.warn(`[multiview] ${id} failed, trying next:`, (e as Error).message);
            }
        }
        console.warn('[multiview] All Gemini models failed, trying Groq fallback');
    }

    // ── Groq fallback ─────────────────────────────────────────────────────────
    if (hasGroqKey) {
        try {
            const res = await withTimeout(
                groqWithFallback((groq) =>
                    groq.chat.completions.create({
                        model: 'qwen/qwen3.6-27b',
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: USER_PROMPT },
                                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
                                ],
                            },
                        ],
                        temperature: 0.1,
                        max_tokens: 2500,
                    })
                ),
                25_000,
                'Groq Qwen'
            );
            console.log('[multiview] Provider: Groq Qwen 3.6 Vision ✓');
            return extractJSON(res.choices[0]?.message?.content ?? '');
        } catch (e) {
            console.warn('[multiview] Groq also failed:', e);
        }
    }

    return UNKNOWN_INCONCLUSIVE_PAYLOAD;
}

export async function POST(req: NextRequest): Promise<NextResponse<IdentifyPartResponse>> {
    try {
        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'identify-part-multiview',
            limit: 10,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` } as IdentifyPartResponse,
                { status: 429 },
            );
        }

        const body = await req.json() as {
            images: { imageBase64: string; mimeType?: string }[];
        };

        const images = body.images ?? [];

        if (images.length === 0) {
            return NextResponse.json({ success: false, error: 'No images provided' } as unknown as IdentifyPartResponse, { status: 400 });
        }

        const groqKey = process.env.GROQ_API_KEY_1 ?? process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const isAllDemo = images.every(i => i.imageBase64 === 'DEMO' || i.imageBase64 === 'MOCK');

        if ((!groqKey && !geminiKey) || isAllDemo) {
            const { payload } = applySafetyGatekeeper({
                ...MOCK_PART_PAYLOAD,
                multi_view: { angle_count: images.length, avg_visual_confidence: 0.96, avg_material_confidence: 0.91, part_class_agreement: true, material_agreement: true },
            } as PartMetadataPayload);
            return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: true });
        }

        const cleanImages = images.slice(0, 3).map(img => ({
            b64: img.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, ''),
            mimeType: img.mimeType ?? 'image/jpeg',
        }));

        console.log(`[multiview] Classifying ${cleanImages.length} angle(s) in parallel…`);
        const individualResults = await Promise.all(
            cleanImages.map(({ b64, mimeType }) => analyseOne(b64, mimeType))
        );

        const merged = mergeVLMResults(individualResults);
        const { payload } = applySafetyGatekeeper(merged);

        console.log(`[multiview] Classified: ${payload.visual_id.part_class} @ ${payload.visual_id.confidence_score}`);

        return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: false });
    } catch (err) {
        console.error('[multiview] Error:', err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error' } as IdentifyPartResponse,
            { status: 500 },
        );
    }
}
