import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqWithFallback } from '@/lib/groqClient';
import { applySafetyGatekeeper } from '@/lib/safetyGatekeeper';
import { MOCK_PART_PAYLOAD } from '@/lib/mockData';
import { enrichPayloadForCitizenWasteGuidance } from '@/lib/wasteGuidance';
import { checkRateLimit } from '@/lib/requestRateLimit';
import type { PartMetadataPayload, IdentifyPartResponse } from '@/types';

// Extend Next.js route timeout to 90s to accommodate slow vision model responses
export const maxDuration = 90;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify-part
//
// Provider priority:
//   1. GROQ_API_KEY  → Qwen 3.6 27B Vision (qwen/qwen3.6-27b)
//   2. GEMINI_API_KEY → Gemini 1.5 Flash Latest
//   3. No key or imageBase64 === 'DEMO' → realistic mock payload
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a strict JSON waste & industrial component classification engine for AI-EcoTrack. You analyse images of industrial parts, electronics, batteries, and general waste items. You MUST return ONLY a valid raw JSON object. Do NOT include <think> tags, reasoning, markdown fences, or conversational text. Start directly with { and end with }.`;

const USER_PROMPT = `Carefully analyse the image and return ONLY raw JSON matching the exact schema below. Every field must be based on what you can VISUALLY OBSERVE in the image — do NOT assume worst-case defaults.

CLASSIFICATION SCOPE:
- battery (lithium-ion, lithium-polymer / LiPo pouch cells, RC batteries with XT60/JST connectors, 18650, lead-acid, NiMH, alkaline)
- pcb (printed circuit boards, motherboards, graphics cards, RAM sticks)
- cable_wire (power cables, ethernet, USB, coaxial, wiring harness, battery leads)
- display_screen (CRT, LCD, OLED panels, monitors, phone screens)
- power_supply (PSUs, SMPS, transformers, adapters, chargers)
- semiconductor_device (ICs, processors, chips, sensors, microcontrollers)
- mobile_device (smartphones, tablets, feature phones)
- peripheral (keyboard, mouse, hard drive, SSD, optical drive)
- gate_valve | centrifugal_pump | heat_exchanger | pressure_vessel | motor | compressor | flange | pipe_fitting | circuit_breaker | transformer
- plastic_waste (PET bottles, HDPE containers, packaging, mixed plastic)
- metal_scrap (steel, aluminium, copper scrap, cans)
- glass_waste (bottles, jars, broken glass)
- paper_cardboard (boxes, newspapers, office paper)
- organic_biodegradable (food waste, garden waste, compostable material)
- hazardous_chemical (paint cans, solvents, pesticides, chemical containers)
- mixed_waste | unknown

WASTE CATEGORIES:
- "biodegradable": organic_biodegradable, natural fibre, food waste
- "recyclable_clean": plastic_waste, metal_scrap, glass_waste, paper_cardboard, intact PCBs, clean cable
- "recyclable_ewaste": pcb, battery (intact), semiconductor_device, mobile_device, display_screen, power_supply, peripheral
- "hazardous": battery (damaged/swollen/lipo), hazardous_chemical, CRT screens, mercury-containing items
- "industrial_component": valves, pumps, motors, pressure vessels
- "mixed": unsorted, unclear

HAZARD RULES:
residual_fluid_risk:
- "battery_electrolyte": lithium battery, swollen cell, electrolyte residue
- "hydrocarbon_likely": visible oil stains, dark grease, petroleum residue
- "chemical_likely": chemical discolouration, crystalline chemical deposits, acid burn marks
- "coolant_likely": green/blue/orange coolant staining
- "none": dry, clean surface
- "unknown": too blurry to determine

pressurized_component: true for valves, pumps, pressure vessels, pipe fittings. false for electronics, batteries, general waste.
asbestos_era_likelihood: true ONLY for fibrous pipe lagging, degraded industrial insulation.
lead_solder_likelihood: true for PCBs, solder joints, old electronics (pre-2006 RoHS).

{
  "visual_id": {
    "part_class": "<see full list above>",
    "subtype": "<specific subtype e.g. '3S LiPo Battery with XT60 Connector', 'FR4 PCB with BGA chips', 'lithium-ion 18650', 'HDPE bottle', or null>",
    "confidence_score": <0.0–1.0>,
    "bounding_box": [0.0, 0.0, 1.0, 1.0]
  },
  "waste_classification": {
    "waste_category": "<biodegradable|recyclable_clean|recyclable_ewaste|hazardous|industrial_component|mixed>",
    "recyclability_score": <0–100>,
    "recommended_stream": "<e.g. 'Authorised E-Waste & Battery Drop-Off', 'Kerbside recycling', 'Composting', 'Hazardous waste depot', 'Reverse manufacturing'>",
    "co2_saving_kg": <estimated kg CO2 saved by correct disposal vs landfill, or null>
  },
  "material_inference": {
    "primary_material": "<316L_stainless_steel|carbon_steel|cast_iron|copper_alloy|titanium|aluminium_alloy|PTFE|FR4_fibreglass|silicon|lithium_compound|polypropylene|PET|HDPE|glass|paper|organic|unknown>",
    "secondary_material": "<secondary or null>",
    "confidence_score": <0.0–1.0>,
    "surface_condition": "<clean|minor_wear|moderate_corrosion_grade_2|heavy_corrosion|damaged|swollen|unknown>",
    "estimated_alloy_grade": "<specific UNS/AISI grade if determinable or null>"
  },
  "hazard_flags": {
    "asbestos_era_likelihood": <true|false>,
    "lead_solder_likelihood": <true|false>,
    "pressurized_component": <true|false>,
    "residual_fluid_risk": "<hydrocarbon_likely|chemical_likely|coolant_likely|battery_electrolyte|none|unknown>"
  },
  "handling_safety": {
    "safety_level": "<danger|caution|safe>",
    "reason": "<one plain-English sentence explaining safety rationale>",
    "ppe_required": ["<list only what is needed e.g. 'nitrile_gloves', 'safety_goggles', 'insulated_gloves', or []>"]
  },
  "geometry_descriptor": {
    "nominal_size_mm": <estimated mm or null>,
    "connection_type": "<flanged_ANSI_B16.5|threaded_NPT|welded|socket_weld|USB|PCIe|XT60|JST|null>",
    "estimated_mass_kg": <estimated kg or null>
  },
  "query_intent": "waste_classification_and_disassembly",
  "fallback_required": false
}

If overall confidence < 0.5, set fallback_required to true and part_class to "unknown".`;

// ── Helper: parse JSON from model text (handles think tags and code fences) ──
function extractJSON(text: string): PartMetadataPayload {
    let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    clean = clean.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in model response');
    return JSON.parse(match[0]) as PartMetadataPayload;
}

async function callGroq(cleanBase64: string, mimeType: string): Promise<PartMetadataPayload> {
    const response = await groqWithFallback((groq) =>
        groq.chat.completions.create({
            model: 'qwen/qwen3.6-27b',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: USER_PROMPT },
                        {
                            type: 'image_url',
                            image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
                        },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: 2500,
        })
    );
    const text = response.choices[0]?.message?.content ?? '';
    return extractJSON(text);
}

// ── Gemini Vision call (model cascade) ──────────────────────────────────────
async function callGemini(cleanBase64: string, mimeType: string): Promise<PartMetadataPayload> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const geminiModels = [
        { id: 'gemini-3.5-flash', timeout: 35_000 },
        { id: 'gemini-2.0-flash', timeout: 50_000 },
    ];
    let lastErr: unknown;
    for (const { id, timeout } of geminiModels) {
        try {
            const model = genAI.getGenerativeModel({ model: id });
            const resultPromise = model.generateContent([
                `${SYSTEM_PROMPT}\n\n${USER_PROMPT}`,
                { inlineData: { data: cleanBase64, mimeType } },
            ]);
            const result = await Promise.race([
                resultPromise,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`[timeout] ${id} exceeded ${timeout}ms`)), timeout)
                ),
            ]);
            console.log(`[identify-part] Provider: ${id} ✓`);
            return extractJSON(result.response.text().trim());
        } catch (e) {
            console.warn(`[identify-part] ${id} failed, trying next:`, (e as Error).message);
            lastErr = e;
        }
    }
    throw lastErr ?? new Error('All Gemini models failed');
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

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse<IdentifyPartResponse>> {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'identify-part',
            limit: 12,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429 },
            );
        }

        const body = await request.json();
        const { imageBase64, mimeType = 'image/jpeg' } = body as {
            imageBase64: string;
            mimeType: string;
        };

        // Check for any Groq key OR gemini key
        const groqKey = process.env.GROQ_API_KEY_1 ?? process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        // ── Mock mode ────────────────────────────────────────────────────────
        if ((!groqKey && !geminiKey) || imageBase64 === 'DEMO' || imageBase64 === 'MOCK') {
            const { payload } = applySafetyGatekeeper(MOCK_PART_PAYLOAD);
            return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: true });
        }

        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');

        // ── Try Gemini first, Groq as fallback ────────────────────────────────────
        let rawPayload: PartMetadataPayload | null = null;

        if (geminiKey) {
            try {
                rawPayload = await callGemini(cleanBase64, mimeType);
                console.log('[identify-part] Provider: Gemini 2.0 Flash ✓');
            } catch (err) {
                console.warn('[identify-part] Gemini failed, trying Groq fallback:', err);
            }
        }

        if (!rawPayload && groqKey) {
            try {
                rawPayload = await callGroq(cleanBase64, mimeType);
                console.log('[identify-part] Provider: Groq Qwen 3.6 Vision ✓');
            } catch (err) {
                console.warn('[identify-part] Groq also failed:', err);
            }
        }

        if (!rawPayload) {
            return NextResponse.json(
                { success: false, error: 'Part identification provider unavailable.' },
                { status: 502 },
            );
        }

        const { payload } = applySafetyGatekeeper(rawPayload);
        return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: false });

    } catch (error) {
        console.error('[identify-part] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
