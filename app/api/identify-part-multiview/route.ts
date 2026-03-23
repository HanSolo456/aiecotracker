import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqWithFallback } from '@/lib/groqClient';
import { applySafetyGatekeeper } from '@/lib/safetyGatekeeper';
import { mergeVLMResults } from '@/lib/mergeVLMResults';
import { MOCK_PART_PAYLOAD } from '@/lib/mockData';
import { enrichPayloadForCitizenWasteGuidance } from '@/lib/wasteGuidance';
import { checkRateLimit } from '@/lib/requestRateLimit';
import type { PartMetadataPayload, IdentifyPartResponse } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify-part-multiview
//
// Accepts: { images: [{ imageBase64: string, mimeType: string }] }  (1–3 images)
// Returns: IdentifyPartResponse with merged payload + multi_view annotation
//
// Covers: Industrial parts, PCBs, e-waste, and general waste categories
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI waste classification engine for AI-EcoTrack — a Circular Waste Intelligence Platform. You analyse images of waste items and industrial components to classify them for responsible recycling, disassembly, or disposal. Return ONLY a valid JSON object — no prose, no markdown fences.`;

const USER_PROMPT = `Carefully analyse the image and return ONLY raw JSON matching the exact schema below. Every field must be based on what you can VISUALLY OBSERVE in the image — do NOT assume worst-case defaults.

CLASSIFICATION SCOPE — you must identify items from ALL of these categories:

ELECTRONIC & E-WASTE:
- pcb (printed circuit boards, motherboards, graphics cards, RAM sticks)
- battery (lithium-ion, lead-acid, NiMH, alkaline — any battery technology)
- cable_wire (power cables, ethernet, USB, coaxial, wiring harness)
- display_screen (CRT, LCD, OLED panels, monitors)
- power_supply (PSUs, SMPS, transformers, adapters)
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
- "recyclable_ewaste": pcb, battery, semiconductor_device, mobile_device, display_screen, power_supply, peripheral
- "hazardous": battery (damaged/leaking), hazardous_chemical, CRT screens, mercury-containing items, items with visible chemical contamination
- "industrial_component": valves, pumps, motors, pressure vessels — follow reverse manufacturing protocol
- "mixed": unsorted, unclear

HAZARD FLAG RULES:
residual_fluid_risk:
- "hydrocarbon_likely": visible oil stains, dark grease, petroleum residue
- "chemical_likely": chemical discolouration, crystalline chemical deposits, acid burn marks
- "coolant_likely": green/blue/orange coolant staining
- "battery_electrolyte": visible battery leakage, white crystalline residue near battery terminals
- "none": dry, clean surface
- "unknown": too blurry to determine

pressurized_component: true for valves, pumps, pressure vessels, pipe fittings. false for electronics, waste.

asbestos_era_likelihood: true ONLY for fibrous pipe lagging, degraded industrial insulation.

lead_solder_likelihood: true for PCBs, solder joints, old electronics (pre-2006 RoHS). Also true for CRT monitors.

{
  "visual_id": {
    "part_class": "<see full list above>",
    "subtype": "<specific subtype e.g. 'FR4 PCB with BGA chips', 'lithium-ion 18650', 'HDPE bottle', or null>",
    "confidence_score": <0.0–1.0>,
    "bounding_box": [0.0, 0.0, 1.0, 1.0]
  },
  "waste_classification": {
    "waste_category": "<biodegradable|recyclable_clean|recyclable_ewaste|hazardous|industrial_component|mixed>",
    "recyclability_score": <0–100, where 100 = fully recyclable with current technology>,
    "recommended_stream": "<e.g. 'E-waste facility', 'Kerbside recycling', 'Composting', 'Hazardous waste depot', 'Reverse manufacturing'>",
    "co2_saving_kg": <estimated kg CO2 saved by correct disposal vs landfill, or null>
  },
  "material_inference": {
    "primary_material": "<316L_stainless_steel|carbon_steel|cast_iron|copper_alloy|titanium|aluminium_alloy|PTFE|FR4_fibreglass|silicon|lithium_compound|polypropylene|PET|HDPE|glass|paper|organic|unknown>",
    "secondary_material": "<secondary or null>",
    "confidence_score": <0.0–1.0>,
    "surface_condition": "<clean|minor_wear|moderate_corrosion_grade_2|heavy_corrosion|damaged|unknown>",
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
    "reason": "<one plain-English sentence explaining why — e.g. 'Contains lead solder and lithium battery, risk of toxic exposure.' or 'Clean recyclable plastic, no hazardous materials detected.'>",
    "ppe_required": ["<list only what is needed e.g. 'nitrile_gloves', 'face_mask', 'safety_goggles', 'full_PPE_suit', or empty array []>"]
  },
  "geometry_descriptor": {
    "nominal_size_mm": <estimated mm or null>,
    "connection_type": "<flanged_ANSI_B16.5|threaded_NPT|welded|socket_weld|USB|PCIe|null>",
    "estimated_mass_kg": <number or null>
  },
  "query_intent": "waste_classification_and_disassembly",
  "fallback_required": false
}

HANDLING SAFETY RULES — set safety_level based on these:
- "danger": leaking battery / chemical container / CRT screen / asbestos / unknown liquid contamination / any item where contact without full PPE risks injury or toxic exposure.
- "caution": PCBs with solder / pressurized components / hydrocarbon residue / industrial parts requiring lockout-tagout / items needing gloves but otherwise manageable.
- "safe": clean plastics / paper / glass / organic waste / dry intact electronics with no leakage or solder exposure risk.

If overall confidence < 0.5, set fallback_required to true and part_class to "unknown".`;

function extractJSON(text: string): PartMetadataPayload {
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return JSON.parse(match[0]) as PartMetadataPayload;
}

async function analyseOne(b64: string, mimeType: string): Promise<PartMetadataPayload> {
    const geminiKey = process.env.GEMINI_API_KEY;
    const hasGroqKey = !!(process.env.GROQ_API_KEY_1 ?? process.env.GROQ_API_KEY);

    if (hasGroqKey) {
        try {
            const res = await groqWithFallback((groq) =>
                groq.chat.completions.create({
                    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
                    max_tokens: 1200,
                })
            );
            return extractJSON(res.choices[0]?.message?.content ?? '');
        } catch (e) {
            console.warn('[multiview] All Groq keys exhausted for angle:', e);
        }
    }

    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
            const result = await model.generateContent([
                `${SYSTEM_PROMPT}\n\n${USER_PROMPT}`,
                { inlineData: { data: b64, mimeType } },
            ]);
            return extractJSON(result.response.text().trim());
        } catch (e) {
            console.warn('[multiview] Gemini failed for angle:', e);
        }
    }

    return MOCK_PART_PAYLOAD;
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
