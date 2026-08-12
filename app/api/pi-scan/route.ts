import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqWithFallback } from '@/lib/groqClient';
import { applySafetyGatekeeper } from '@/lib/safetyGatekeeper';
import { mergeVLMResults } from '@/lib/mergeVLMResults';
import { retrieveGuide } from '@/lib/knowledgeBase';
import { MOCK_PART_PAYLOAD } from '@/lib/mockData';
import { enrichPayloadForCitizenWasteGuidance } from '@/lib/wasteGuidance';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import type { PartMetadataPayload } from '@/types';
import { touchDeviceLastSeen, verifyDeviceToken } from '@/lib/deviceRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pi-scan
//
// Raspberry Pi endpoint — runs the full pipeline in one request:
//   1. Authenticate device token (x-device-token header)
//   2. Identify part via VLM (Groq/Gemini/mock)
//   3. Retrieve disassembly guide via RAG
//   4. Save scan to Firestore tagged as source='raspberry_pi'
//   5. Return full payload + guide + passport_id
//
// Body: { images: string[], device_id?: string }
//   images: Base64-encoded JPEG strings (1–3, no data: prefix needed)
//
// Python example:
//   import requests, base64
//   img_b64 = base64.b64encode(open("part.jpg","rb").read()).decode()
//   r = requests.post("https://yourapp.vercel.app/api/pi-scan",
//       headers={"x-device-token": "your-secret"},
//       json={"images": [img_b64], "device_id": "pi-001"})
//   print(r.json())
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an industrial parts identification AI for a reverse manufacturing platform called AI-EcoTrack. Analyse the image of an industrial component and return ONLY a valid JSON object — no prose, no markdown fences.`;

const USER_PROMPT = `Carefully analyse the image and return ONLY raw JSON matching the exact schema below. Every field must be based on what you can VISUALLY OBSERVE.

{
  "visual_id": { "part_class": "<gate_valve|centrifugal_pump|heat_exchanger|pressure_vessel|motor|compressor|flange|pipe_fitting|circuit_breaker|transformer|unknown>", "subtype": "<string or null>", "confidence_score": <0.0–1.0>, "bounding_box": [0.0, 0.0, 1.0, 1.0] },
  "material_inference": { "primary_material": "<316L_stainless_steel|carbon_steel|cast_iron|copper_alloy|titanium|inconel_625|aluminium_alloy|PTFE|unknown>", "secondary_material": null, "estimated_alloy_grade": "<string or null>", "surface_condition": "<clean|minor_wear|moderate_corrosion_grade_2|heavy_corrosion>", "confidence_score": <0.0–1.0> },
  "geometry_descriptor": { "estimated_mass_kg": <number or null>, "nominal_size_mm": <number or null>, "aspect_ratio": "<compact|elongated|flat>", "symmetry": "<radial|bilateral|asymmetric>" },
  "hazard_flags": { "residual_fluid_risk": "<hydrocarbon_likely|chemical_likely|coolant_likely|none|unknown>", "pressurized_component": <true|false>, "asbestos_era_likelihood": <true|false>, "lead_solder_likelihood": <true|false> },
  "escalation_required": <true|false>,
  "processing_notes": "<brief string>"
}`;

function extractJSON(text: string): PartMetadataPayload {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
    const raw = fence ?? text;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON found in VLM response');
    return JSON.parse(m[0]);
}

async function analyseOne(b64: string, mimeType: string): Promise<PartMetadataPayload> {
    const hasGroqKey = !!(process.env.GROQ_API_KEY_1 ?? process.env.GROQ_API_KEY);
    const geminiKey = process.env.GEMINI_API_KEY;

    if (hasGroqKey) {
        try {
            const res = await groqWithFallback((groq) =>
                groq.chat.completions.create({
                    model: 'qwen/qwen3.6-27b',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: [{ type: 'text', text: USER_PROMPT }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } }] },
                    ],
                    temperature: 0.1, max_tokens: 1024,
                })
            );
            return extractJSON(res.choices[0]?.message?.content ?? '');
        } catch (e) { console.warn('[pi-scan] All Groq keys exhausted:', e); }
    }

    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
            const result = await model.generateContent([`${SYSTEM_PROMPT}\n\n${USER_PROMPT}`, { inlineData: { data: b64, mimeType } }]);
            return extractJSON(result.response.text().trim());
        } catch (e) { console.warn('[pi-scan] Gemini failed:', e); }
    }

    return MOCK_PART_PAYLOAD;
}

export async function POST(req: NextRequest) {
    try {
        const deviceToken = req.headers.get('x-device-token');
        if (!deviceToken) {
            return NextResponse.json({ success: false, error: 'Missing x-device-token header' }, { status: 401 });
        }

        const body = await req.json() as { images: string[]; device_id?: string };
        const rawImages = body.images ?? [];
        const deviceId = (body.device_id ?? '').trim().toLowerCase();

        if (!deviceId) {
            return NextResponse.json({ success: false, error: 'device_id is required' }, { status: 400 });
        }

        const verification = await verifyDeviceToken(deviceId, deviceToken);
        if (!verification.ok) {
            const map: Record<typeof verification.reason, number> = {
                not_found: 404,
                inactive: 403,
                invalid_token: 401,
            };
            return NextResponse.json(
                { success: false, error: `Device auth failed: ${verification.reason}` },
                { status: map[verification.reason] },
            );
        }

        if (rawImages.length === 0) {
            return NextResponse.json({ success: false, error: 'No images provided' }, { status: 400 });
        }

        // Strip data: prefix if Pi sends full data URLs
        const cleanImages = rawImages.slice(0, 3).map(img => ({
            b64: img.replace(/^data:image\/[a-z+]+;base64,/, ''),
            mimeType: 'image/jpeg',
        }));

        // ── Step 1: VLM identification ───────────────────────────────────────
        console.log(`[pi-scan] device=${verification.device.deviceId} analysing ${cleanImages.length} image(s)`);
        const individualResults = await Promise.all(
            cleanImages.map(({ b64, mimeType }) => analyseOne(b64, mimeType))
        );
        const merged = mergeVLMResults(individualResults);
        const { payload: gatedPayload } = applySafetyGatekeeper(merged);
        const payload = enrichPayloadForCitizenWasteGuidance(gatedPayload);

        // ── Step 2: RAG guide retrieval ──────────────────────────────────────
        const guide = await retrieveGuide(payload);

        // ── Step 3: Save to Firestore as 'raspberry_pi' source ───────────────
        let scanId: string | null = null;
        try {
            initializeAdmin();
            const adminDb = getFirestore();

            const partNames: Record<string, string> = {
                gate_valve: 'Gate Valve', centrifugal_pump: 'Centrifugal Pump',
                heat_exchanger: 'Heat Exchanger', pressure_vessel: 'Pressure Vessel',
                motor: 'Electric Motor', compressor: 'Compressor',
                flange: 'Flange', pipe_fitting: 'Pipe Fitting',
                circuit_breaker: 'Circuit Breaker', transformer: 'Transformer',
                unknown: 'Unknown Part',
            };
            const partConf = payload.visual_id.confidence_score;
            const matConf = payload.material_inference.confidence_score;
            const wri = Math.round(((partConf + matConf) / 2) * 100) / 100;
            const grade = wri >= 0.85 ? 'A' : wri >= 0.65 ? 'B' : 'C';

            const record = {
                createdAt: new Date(),
                orgId: verification.device.orgId,
                partName: partNames[payload.visual_id.part_class] ?? payload.visual_id.part_class,
                subtype: payload.visual_id.subtype ?? null,
                material: payload.material_inference.primary_material,
                alloyGrade: payload.material_inference.estimated_alloy_grade ?? null,
                surfaceCondition: payload.material_inference.surface_condition,
                partConfidence: partConf,
                materialConfidence: matConf,
                estimatedMassKg: payload.geometry_descriptor?.estimated_mass_kg ?? null,
                nominalSizeMm: payload.geometry_descriptor?.nominal_size_mm ?? null,
                wriScore: wri,
                recoveryValueUSD: 0,
                grade,
                hazardFlags: payload.hazard_flags,
                escalationRequired: payload.escalation_required ?? false,
                imageThumb: cleanImages.length > 0 ? `data:${cleanImages[0].mimeType};base64,${cleanImages[0].b64}` : '',
                scanMode: cleanImages.length > 1 ? 'multi-view' : 'single',
                source: 'raspberry_pi',
                deviceId: verification.device.deviceId,
                fullPayload: JSON.stringify(payload),
                guide: JSON.stringify(guide),
                dpp: '{}',
            };

            const docRef = await adminDb.collection('scans').add(record);
            scanId = docRef.id;
            await touchDeviceLastSeen(verification.device.deviceId);
            console.log(`[pi-scan] Saved scan ${scanId} for device ${verification.device.deviceId}`);
        } catch (err) {
            console.warn('[pi-scan] Firestore write failed (non-fatal):', err);
        }

        return NextResponse.json({
            success: true,
            scan_id: scanId,
            device_id: verification.device.deviceId,
            org_id: verification.device.orgId,
            payload,
            guide,
            summary: {
                part: payload.visual_id.part_class,
                material: payload.material_inference.primary_material,
                confidence: payload.visual_id.confidence_score,
                escalation_required: payload.escalation_required,
            },
        });
    } catch (err) {
        console.error('[pi-scan] Error:', err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
