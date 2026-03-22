import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqWithFallback } from '@/lib/groqClient';
import { applySafetyGatekeeper } from '@/lib/safetyGatekeeper';
import { MOCK_PART_PAYLOAD } from '@/lib/mockData';
import { checkRateLimit } from '@/lib/requestRateLimit';
import type { PartMetadataPayload, IdentifyPartResponse } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify-part
//
// Provider priority:
//   1. GROQ_API_KEY  → Llama 3.2 Vision (free, fast, generous limits)
//   2. GEMINI_API_KEY → Gemini 1.5 Flash Latest
//   3. No key or imageBase64 === 'DEMO' → realistic mock payload
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an industrial parts identification AI for a reverse manufacturing platform called AI-EcoTrack. Analyse the image of an industrial component and return ONLY a valid JSON object — no prose, no markdown fences.`;

const USER_PROMPT = `Carefully analyse the image and return ONLY raw JSON matching the exact schema below. Every field must be based on what you can VISUALLY OBSERVE in the image — do NOT assume worst-case defaults.

HAZARD FLAG RULES — follow these exactly, do NOT default every part to maximum hazard:

residual_fluid_risk:
- Set "hydrocarbon_likely" ONLY IF you can VISUALLY SEE dark oily stains, wet petroleum residue, black grease streaks, or liquid pooling around the part.
- Set "chemical_likely" ONLY IF you can VISUALLY SEE chemical discolouration, crystalline deposits, or chemical corrosion patterns distinct from rust.
- Set "coolant_likely" ONLY IF you can VISUALLY SEE green/blue/orange coolant staining or dried coolant residue.
- Set "none" if the surface is dry, uniformly corroded with rust only, or clearly clean. Rust alone is NOT a fluid risk.
- Set "unknown" only if the image is too blurry or occluded to determine.

pressurized_component:
- Set true for valves, pumps, pressure vessels, heat exchangers, pipe fittings.
- Set false for motors, transformers, circuit breakers, structural parts.

asbestos_era_likelihood:
- Set true ONLY IF you can see visible fibrous lagging, degraded pipe insulation, or old gasket material that appears fibrous/white.
- Set false for bare metal parts with no insulation visible.

lead_solder_likelihood:
- Set true ONLY IF electronics, PCBs, or visible solder joints are present.
- Set false for purely mechanical/hydraulic components.

surface_condition:
- "clean": no visible corrosion, oils, or damage.
- "minor_wear": surface wear or light oxide layer, no structural pitting.
- "moderate_corrosion_grade_2": visible rust patches covering <50% of surface, structural integrity likely intact.
- "heavy_corrosion": severe pitting, scale, or rust encrustation covering >50% of surface, bolts/features obscured.

confidence_score:
- Be conservative. If the part is heavily degraded, obscured, or lacks scale reference, score lower.

{
  "visual_id": {
    "part_class": "<gate_valve|centrifugal_pump|heat_exchanger|pressure_vessel|motor|compressor|flange|pipe_fitting|circuit_breaker|transformer|unknown>",
    "subtype": "<specific subtype e.g. flanged globe valve, plate-and-frame, or null>",
    "confidence_score": <0.0–1.0>,
    "bounding_box": [0.0, 0.0, 1.0, 1.0]
  },
  "material_inference": {
    "primary_material": "<316L_stainless_steel|carbon_steel|cast_iron|copper_alloy|titanium|inconel_625|aluminium_alloy|PTFE|unknown>",
    "secondary_material": "<secondary material or null>",
    "confidence_score": <0.0–1.0>,
    "surface_condition": "<clean|minor_wear|moderate_corrosion_grade_2|heavy_corrosion|unknown>",
    "estimated_alloy_grade": "<specific UNS/AISI grade if determinable e.g. UNS_S31603, AISI_1020, or null>"
  },
  "hazard_flags": {
    "asbestos_era_likelihood": <true|false — based on VISUAL evidence only>,
    "lead_solder_likelihood": <true|false — based on VISUAL evidence only>,
    "pressurized_component": <true|false — based on part type>,
    "residual_fluid_risk": "<hydrocarbon_likely|chemical_likely|coolant_likely|none|unknown — based on VISUAL evidence of actual fluid residue>"
  },
  "geometry_descriptor": {
    "nominal_size_mm": <estimated mm based on visible bolt patterns, flange dimensions, or null if no reference>,
    "connection_type": "<flanged_ANSI_B16.5|threaded_NPT|welded|socket_weld|null>",
    "estimated_mass_kg": <estimated kg or null>
  },
  "query_intent": "disassembly_sequence_retrieval",
  "fallback_required": false
}

If overall confidence < 0.5, set fallback_required to true and part_class to "unknown".`;

// ── Helper: parse JSON from model text (handles code fences) ─────────────────
function extractJSON(text: string): PartMetadataPayload {
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in model response');
    return JSON.parse(match[0]) as PartMetadataPayload;
}

async function callGroq(cleanBase64: string, mimeType: string): Promise<PartMetadataPayload> {
    const response = await groqWithFallback((groq) =>
        groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
            max_tokens: 1024,
        })
    );
    const text = response.choices[0]?.message?.content ?? '';
    return extractJSON(text);
}

// ── Gemini Vision call ───────────────────────────────────────────────────────
async function callGemini(cleanBase64: string, mimeType: string): Promise<PartMetadataPayload> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    const result = await model.generateContent([
        `${SYSTEM_PROMPT}\n\n${USER_PROMPT}`,
        { inlineData: { data: cleanBase64, mimeType } },
    ]);
    return extractJSON(result.response.text().trim());
}

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
            return NextResponse.json({ success: true, payload, mock: true });
        }

        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');

        // ── Try Groq first, then Gemini ──────────────────────────────────────
        let rawPayload: PartMetadataPayload | null = null;

        if (groqKey) {
            try {
                rawPayload = await callGroq(cleanBase64, mimeType);
                console.log('[identify-part] Provider: Groq Llama Vision ✓');
            } catch (err) {
                console.warn('[identify-part] Groq failed, trying Gemini:', err);
            }
        }

        if (!rawPayload && geminiKey) {
            try {
                rawPayload = await callGemini(cleanBase64, mimeType);
                console.log('[identify-part] Provider: Gemini 1.5 Flash ✓');
            } catch (err) {
                console.warn('[identify-part] Gemini failed, falling back to mock:', err);
            }
        }

        if (!rawPayload) {
            return NextResponse.json(
                { success: false, error: 'Part identification provider unavailable.' },
                { status: 502 },
            );
        }

        const { payload } = applySafetyGatekeeper(rawPayload);
        return NextResponse.json({ success: true, payload, mock: false });

    } catch (error) {
        console.error('[identify-part] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
