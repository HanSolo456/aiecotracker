import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGroqKeys } from '@/lib/groqClient';
import { SYSTEM_PROMPT, USER_PROMPT } from '@/lib/visionPrompts';
import type { PartMetadataPayload } from '@/types';

export class VisionUnavailableError extends Error {
    constructor() {
        super('AI scanning is temporarily unavailable. Please try again shortly. Your photos are still available to retry.');
        this.name = 'VisionUnavailableError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isScore = (value: unknown): boolean =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Invalid model output must trigger the next provider before it reaches the safety engine. */
export function parseVisionPayload(text: string): PartMetadataPayload {
    const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No classification JSON');
    const p: unknown = JSON.parse(match[0]);
    if (!isRecord(p) || !isRecord(p.visual_id) || !isRecord(p.material_inference) ||
        !isRecord(p.hazard_flags) || !isRecord(p.geometry_descriptor)) {
        throw new Error('Incomplete classification');
    }
    const v = p.visual_id, m = p.material_inference, h = p.hazard_flags;
    if (typeof v.part_class !== 'string' || !v.part_class.trim() ||
        !(v.subtype == null || typeof v.subtype === 'string') || !isScore(v.confidence_score) ||
        typeof m.primary_material !== 'string' || !m.primary_material.trim() || !isScore(m.confidence_score) ||
        ['asbestos_era_likelihood', 'lead_solder_likelihood', 'pressurized_component'].some(k => typeof h[k] !== 'boolean') ||
        typeof h.residual_fluid_risk !== 'string' || typeof p.fallback_required !== 'boolean' ||
        !['disassembly_sequence_retrieval', 'material_data_retrieval', 'safety_protocol_retrieval', 'waste_classification_and_disassembly'].includes(String(p.query_intent))) {
        throw new Error('Invalid classification fields');
    }
    for (const key of ['estimated_mass_kg', 'nominal_size_mm']) {
        const value = p.geometry_descriptor[key];
        if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
            throw new Error('Invalid geometry');
        }
    }
    if (p.waste_classification != null) {
        const w = p.waste_classification;
        if (!isRecord(w) || !['biodegradable', 'recyclable_clean', 'recyclable_ewaste', 'hazardous', 'industrial_component', 'mixed'].includes(String(w.waste_category)) ||
            typeof w.recyclability_score !== 'number' || !isScore(w.recyclability_score / 100) ||
            typeof w.recommended_stream !== 'string' ||
            !(w.co2_saving_kg === null || (typeof w.co2_saving_kg === 'number' && Number.isFinite(w.co2_saving_kg) && w.co2_saving_kg >= 0))) {
            throw new Error('Invalid waste classification');
        }
    }
    if (p.handling_safety != null) {
        const s = p.handling_safety;
        if (!isRecord(s) || !['safe', 'caution', 'danger'].includes(String(s.safety_level)) ||
            typeof s.reason !== 'string' || !Array.isArray(s.ppe_required) || s.ppe_required.some(item => typeof item !== 'string')) {
            throw new Error('Invalid handling safety');
        }
    }
    v.subtype ??= '';
    return p as unknown as PartMetadataPayload;
}

/** Keep the entire cascade below the routes' 90-second limit, including key rotation. */
export async function classifyImage(b64: string, mimeType: string): Promise<PartMetadataPayload> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const models = [
            { id: process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash', timeout: 20_000 },
            { id: process.env.GEMINI_VISION_FALLBACK_MODEL || 'gemini-3.7-flash', timeout: 10_000 },
        ];
        for (const { id, timeout } of models) {
            try {
                const model = genAI.getGenerativeModel({ model: id });
                const result = await model.generateContent([
                    `${SYSTEM_PROMPT}\n\n${USER_PROMPT}`,
                    { inlineData: { data: b64, mimeType } },
                ], { signal: AbortSignal.timeout(timeout) });
                return parseVisionPayload(result.response.text());
            } catch {
                console.warn(`[vision] Gemini (${id}) failed; trying next provider/model.`);
            }
        }
    }

    // Native fetch avoids premature stream closures in the older Groq SDK.
    // All keys share one deadline; there are no hidden retries.
    const deadline = Date.now() + 25_000;
    for (const [index, apiKey] of getGroqKeys().entries()) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                cache: 'no-store',
                signal: AbortSignal.timeout(Math.min(10_000, remaining)),
                body: JSON.stringify({
                    model: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: [
                            { type: 'text', text: USER_PROMPT },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
                        ] },
                    ],
                    temperature: 0.1,
                    max_tokens: 2500,
                    response_format: { type: 'json_object' },
                }),
            });
            if (!response.ok) throw new Error(`Groq HTTP ${response.status}`);
            const result = await response.json() as { choices?: { message?: { content?: string } }[] };
            return parseVisionPayload(result.choices?.[0]?.message?.content ?? '');
        } catch {
            console.warn(`[vision] Groq key #${index + 1} failed; trying next available key.`);
        }
    }
    throw new VisionUnavailableError();
}
