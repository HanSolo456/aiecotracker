/**
 * AI Guide Generator — Fallback for Unknown Waste Items
 * ──────────────────────────────────────────────────────
 * Called when a scanned item has no matching entry in the static knowledge base.
 * Uses Groq/Gemini to generate contextually accurate:
 *   - Handling & disposal guide steps
 *   - Bill of Materials (material sub-components)
 *
 * This makes the platform self-extending: any new waste type is handled
 * automatically via AI inference, without manual JSON updates.
 */

import { groqWithFallback } from '@/lib/groqClient';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PartMetadataPayload, DisassemblyStep, BillOfMaterialsEntry } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIGeneratedGuide {
    steps: DisassemblyStep[];
    safety_protocols: string[];
    ai_generated: true;
}

export interface AIGeneratedBOM {
    entries: BillOfMaterialsEntry[];
    total_mass_kg: number;
    ai_generated: true;
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function buildGuidePrompt(payload: PartMetadataPayload): string {
    const { visual_id, material_inference, hazard_flags, waste_classification, handling_safety } =
        payload as PartMetadataPayload & {
            waste_classification?: { waste_category?: string; recommended_stream?: string };
            handling_safety?: { safety_level?: string; reason?: string; ppe_required?: string[] };
        };

    return `You are an expert waste management and recycling specialist for AI-EcoTrack, an Indian circular waste intelligence platform.

Generate a safe handling and disposal guide for the following scanned waste item:

ITEM DETAILS:
- Type: ${visual_id.part_class} (${visual_id.subtype ?? 'general'})
- Primary material: ${material_inference.primary_material}
- Secondary material: ${material_inference.secondary_material ?? 'none'}
- Waste category: ${waste_classification?.waste_category ?? 'unknown'}
- Recommended stream: ${waste_classification?.recommended_stream ?? 'unknown'}
- Safety level: ${handling_safety?.safety_level ?? 'unknown'}
- Safety reason: ${handling_safety?.reason ?? 'unknown'}
- PPE required: ${handling_safety?.ppe_required?.join(', ') ?? 'none specified'}
- Hazard flags: ${JSON.stringify(hazard_flags)}

Generate EXACTLY 5 handling/disposal steps appropriate for a waste collection worker in India.
Each step must be practical, safety-first, and aligned with Indian e-waste rules (E-Waste Management Rules 2022, CPCB guidelines) where applicable.

Return ONLY raw JSON — no prose, no markdown. Exact schema:
{
  "steps": [
    {
      "step": 1,
      "action": "<concise practical action in plain English>",
      "tool_required": "<tool name or null>",
      "safety_ref": "<regulation reference or null>",
      "estimated_time_min": <number>
    }
  ],
  "safety_protocols": ["<regulation_id>"]
}`;
}

function buildBOMPrompt(payload: PartMetadataPayload, totalMassKg: number): string {
    const { visual_id, material_inference, waste_classification, hazard_flags } =
        payload as PartMetadataPayload & {
            waste_classification?: { waste_category?: string };
        };

    return `You are a materials expert for AI-EcoTrack, a waste classification platform.

Generate a Bill of Materials (sub-component breakdown) for this scanned item:

ITEM DETAILS:
- Type: ${visual_id.part_class} (${visual_id.subtype ?? 'general'})
- Total estimated mass: ${totalMassKg} kg
- Primary material: ${material_inference.primary_material}
- Secondary material: ${material_inference.secondary_material ?? 'none'}
- Waste category: ${waste_classification?.waste_category ?? 'unknown'}
- Contains lead solder: ${hazard_flags.lead_solder_likelihood}
- Other hazard flags: ${JSON.stringify(hazard_flags)}

Break down the item into 3-6 realistic sub-components. Mass fractions must sum to 1.0.
Recyclability class: A = fully recyclable, B = recyclable with processing, C = non-recyclable/hazardous.
Use realistic Indian scrap market prices in INR per kg.

Return ONLY raw JSON — no prose, no markdown. Exact schema:
{
  "entries": [
    {
      "component_name": "<snake_case_name>",
      "material_designation": "<human readable material name>",
      "mass_kg": <number>,
      "mass_fraction_pct": <number 0-100>,
      "recyclability_class": "<A|B|C>",
      "recovery_value_usd_per_kg": <INR value as number>,
      "hazardous_substance_content": <true|false>
    }
  ]
}`;
}

// ── JSON extraction helper ───────────────────────────────────────────────────

function extractJSON<T>(text: string): T {
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in AI response');
    return JSON.parse(match[0]) as T;
}

// ── Core AI caller ───────────────────────────────────────────────────────────

async function callAI<T>(prompt: string): Promise<T> {
    const groqAvailable = !!(process.env.GROQ_API_KEY_1 ?? process.env.GROQ_API_KEY);
    const geminiKey = process.env.GEMINI_API_KEY;

    if (groqAvailable) {
        const GROQ_GUIDE_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        for (const modelName of GROQ_GUIDE_MODELS) {
            try {
                const res = await groqWithFallback((groq) =>
                    groq.chat.completions.create({
                        model: modelName,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.2,
                        max_tokens: 1000,
                    })
                );
                const content = res.choices[0]?.message?.content ?? '';
                if (content) return extractJSON<T>(content);
            } catch (e) {
                console.warn(`[aiGuideGenerator] Groq model ${modelName} failed:`, e);
            }
        }
    }

    if (geminiKey) {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        const result = await model.generateContent(prompt);
        return extractJSON<T>(result.response.text().trim());
    }

    throw new Error('[aiGuideGenerator] No AI provider available');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a handling/disposal guide for an item not in the knowledge base.
 * Returns AI-generated steps with safety_protocols array.
 */
export async function generateAIGuide(
    payload: PartMetadataPayload
): Promise<AIGeneratedGuide> {
    console.log(`[aiGuideGenerator] Generating guide for unknown item: ${payload.visual_id.part_class}`);
    try {
        const result = await callAI<{ steps: DisassemblyStep[]; safety_protocols: string[] }>(
            buildGuidePrompt(payload)
        );

        // Normalise step numbers
        const steps = (result.steps ?? []).map((s, i) => ({
            ...s,
            step: i + 1,
            estimated_time_min: s.estimated_time_min ?? 5,
            tool_required: s.tool_required ?? null,
            safety_ref: s.safety_ref ?? null,
        }));

        return {
            steps,
            safety_protocols: result.safety_protocols ?? [],
            ai_generated: true,
        };
    } catch (err) {
        console.error('[aiGuideGenerator] Guide generation failed:', err);
        // Graceful fallback — generic but safe steps
        return {
            steps: [
                { step: 1, action: 'Put on appropriate PPE (gloves, goggles) before handling.', tool_required: 'nitrile_gloves', safety_ref: 'E_Waste_Rules_2022_India', estimated_time_min: 2 },
                { step: 2, action: 'Visually inspect item for damage, leaks, or hazardous residue.', tool_required: null, safety_ref: null, estimated_time_min: 3 },
                { step: 3, action: 'Label item with waste category and condition (GOOD / DAMAGED / HAZARDOUS).', tool_required: 'labelling_tape', safety_ref: null, estimated_time_min: 2 },
                { step: 4, action: 'Segregate into appropriate collection stream (e-waste, hazardous, recyclable).', tool_required: null, safety_ref: 'E_Waste_Rules_2022_India', estimated_time_min: 3 },
                { step: 5, action: 'Log item to digital record and route to authorised recycler or CPCB-registered facility.', tool_required: 'digital_log_system', safety_ref: 'E_Waste_Rules_2022_EPR', estimated_time_min: 5 },
            ],
            safety_protocols: ['E_Waste_Rules_2022_India'],
            ai_generated: true,
        };
    }
}

/**
 * Generate a Bill of Materials for an item not in the knowledge base.
 * Returns AI-generated material sub-component breakdown.
 */
export async function generateAIBOM(
    payload: PartMetadataPayload,
    totalMassKg: number
): Promise<AIGeneratedBOM> {
    console.log(`[aiGuideGenerator] Generating BOM for unknown item: ${payload.visual_id.part_class}`);
    try {
        const result = await callAI<{ entries: Omit<BillOfMaterialsEntry, 'material_standard' | 'alloy_grade'>[] }>(
            buildBOMPrompt(payload, totalMassKg)
        );

        const entries: BillOfMaterialsEntry[] = (result.entries ?? []).map(e => ({
            ...e,
            material_standard: undefined,
            alloy_grade: null,
            mass_kg: +e.mass_kg.toFixed(3),
            mass_fraction_pct: +e.mass_fraction_pct.toFixed(1),
            recovery_value_usd_per_kg: +e.recovery_value_usd_per_kg.toFixed(2),
        }));

        return {
            entries,
            total_mass_kg: totalMassKg,
            ai_generated: true,
        };
    } catch (err) {
        console.error('[aiGuideGenerator] BOM generation failed:', err);
        // Graceful fallback — single generic entry
        return {
            entries: [
                {
                    component_name: 'mixed_material',
                    material_designation: 'Mixed / Unknown Material',
                    material_standard: undefined,
                    alloy_grade: null,
                    mass_kg: totalMassKg,
                    mass_fraction_pct: 100,
                    recyclability_class: 'B',
                    recovery_value_usd_per_kg: 50,
                    hazardous_substance_content: payload.hazard_flags.lead_solder_likelihood,
                },
            ],
            total_mass_kg: totalMassKg,
            ai_generated: true,
        };
    }
}
