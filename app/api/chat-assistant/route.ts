import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqWithFallback } from '@/lib/groqClient';
import { retrieveGuide } from '@/lib/knowledgeBase';
import { checkRateLimit } from '@/lib/requestRateLimit';
import type {
    ChatAssistantRequest,
    ChatAssistantResponse,
    GuideResult,
    PartMetadataPayload,
    SourceCitation,
} from '@/types';

// ── Live knowledge context injected into the system prompt ────────────────────
// Prices sourced from scrap_pricing_india.json (Mumbai MIDC hub, March 2026)
import scrapPricingRaw from '@/data/knowledge/scrap_pricing_india.json';
import safetyRegsRaw from '@/data/knowledge/safety_regulations.json';

type ScrapMaterial = {
    id: string;
    common_names: string[];
    recycler_category: string;
    recyclability_class: string;
    regional_rates_inr_per_kg: Record<string, number>;
    gst_rate_pct: number;
};

type SafetyReg = {
    id: string;
    title: string;
    summary: string;
};

function buildScrapPricingContext(): string {
    const materials = (scrapPricingRaw as { materials: ScrapMaterial[] }).materials;
    const lines = materials.map(m => {
        const hub = 'Mumbai_MIDC';
        const rate = m.regional_rates_inr_per_kg?.[hub] ?? '—';
        const name = m.common_names?.[0] ?? m.id;
        return `- ${name}: ₹${rate}/kg (${m.recycler_category}, recyclability ${m.recyclability_class})`;
    });
    return lines.join('\n');
}

function buildSafetyRegsContext(): string {
    const regs = safetyRegsRaw as SafetyReg[];
    return regs
        .map(r => `- ${r.id}: ${r.title} — ${r.summary}`)
        .join('\n');
}

const SYSTEM_PROMPT = `You are AI-EcoTrack's assistant — an expert in waste management, circular economy, e-waste disposal, and sustainable manufacturing.

## Core Expertise

### Segregation Efficiency
- Segregation score = % of waste items correctly classified (Grade A) at source.
- Tier system: Elite ≥85%, Good 70–85%, Needs Work 50–70%, Critical <50%.
- High segregation unlocks higher recovery value and reduces landfill contamination.

### CO₂ Avoidance Factors (kg CO₂ per kg material recycled vs landfilled)
- Aluminium: 9.16 kg CO₂/kg  |  Copper: 3.8 kg CO₂/kg  |  PCB/E-waste: 3.1–4.2 kg CO₂/kg
- Plastic: 2.53 kg CO₂/kg  |  Steel/Iron: 1.46 kg CO₂/kg  |  Glass: 0.31 kg CO₂/kg
- Paper/Cardboard: 1.08 kg CO₂/kg  |  Battery (Li-ion): 5.4 kg CO₂/kg

### Live Scrap Market Rates (India — Mumbai MIDC, March 2026, prices in INR/kg excl. GST)
${buildScrapPricingContext()}

### Key Indian Waste Regulations
${buildSafetyRegsContext()}

### E-Waste Regulations (India)
- E-Waste Management Rules 2022 mandate Extended Producer Responsibility (EPR).
- Producers must register on CPCB portal and meet collection targets (10% → 80% over 10 years).
- Consumers must deposit e-waste at authorized collection points — not in general waste.
- Key restricted substances: Lead, Cadmium, Mercury, Hexavalent Chromium, PBB, PBDE.
- WEEE Directive (EU equivalent) bans e-waste in landfill and mandates 85% recovery rate.

### Digital Product Passport (DPP)
- A traceable record of a product's material composition, origin, safety data, and end-of-life routing.
- In AI-EcoTrack, the DPP is auto-generated from scan results and includes material grades, hazard flags, disassembly guides, and carbon footprint.
- DPPs support circular economy by enabling material recovery, reuse, and verifiable ESG reporting.

### Collection Route Optimization
- Optimal collection routes minimize total distance driven by prioritizing highest fill-level bins first.
- Reduces fleet fuel consumption and CO₂ emissions vs. fixed-schedule collection.
- Rule of thumb: routing 5 bins optimally saves ~30% distance vs. sequential collection.

### General Waste Categories (India)
- Wet/Organic: food, garden waste → composting
- Dry/Recyclable: paper, plastic, glass, metal → material recovery
- Hazardous: batteries, paints, chemicals, e-waste → controlled disposal only
- Medical/Biomedical: sharps, contaminated → incineration at authorized facilities

## Behaviour
- Answer questions about scan results, guides, waste regulations, material recovery, CO₂ impact, segregation efficiency, route optimization, and circular economy.
- If a scan result is provided, reference it specifically.
- Be concise (under 200 words unless detail is explicitly requested), direct, and practical.
- Safety-critical information overrides brevity.
- Never invent specific regulations or standards. If uncertain, say so.
- Do not reveal internal implementation details.`;

function normaliseLabel(value: string | null | undefined): string {
    return value ? value.replace(/_/g, ' ') : 'unknown';
}

function buildContextSummary(
    payload: PartMetadataPayload | null,
    guide: GuideResult | null,
): string {
    const sections: string[] = [];

    if (payload) {
        sections.push(`SCAN RESULT
- Part class: ${normaliseLabel(payload.visual_id.part_class)}
- Subtype: ${normaliseLabel(payload.visual_id.subtype)}
- Part confidence: ${Math.round(payload.visual_id.confidence_score * 100)}%
- Primary material: ${normaliseLabel(payload.material_inference.primary_material)}
- Secondary material: ${normaliseLabel(payload.material_inference.secondary_material)}
- Material confidence: ${Math.round(payload.material_inference.confidence_score * 100)}%
- Surface condition: ${normaliseLabel(payload.material_inference.surface_condition)}
- Alloy grade: ${payload.material_inference.estimated_alloy_grade ?? 'unknown'}
- Nominal size: ${payload.geometry_descriptor.nominal_size_mm ?? 'unknown'} mm
- Connection type: ${normaliseLabel(payload.geometry_descriptor.connection_type)}
- Estimated mass: ${payload.geometry_descriptor.estimated_mass_kg ?? 'unknown'} kg
- Pressurized component: ${payload.hazard_flags.pressurized_component ? 'yes' : 'no'}
- Lead solder likelihood: ${payload.hazard_flags.lead_solder_likelihood ? 'yes' : 'no'}
- Asbestos era likelihood: ${payload.hazard_flags.asbestos_era_likelihood ? 'yes' : 'no'}
- Residual fluid risk: ${normaliseLabel(payload.hazard_flags.residual_fluid_risk)}
- Escalation required: ${payload.escalation_required ? 'yes' : 'no'}
- Injected regulations: ${(payload.injected_regulations ?? []).map(normaliseLabel).join(', ') || 'none'}`);
    }

    if (guide) {
        const steps = guide.disassembly_steps
            .slice(0, 6)
            .map((step) => `${step.step}. ${step.action}`)
            .join('\n');
        sections.push(`GUIDE
- Estimated total time: ${guide.estimated_total_time_min} min
- Safety protocols: ${(guide.safety_protocols ?? []).map(normaliseLabel).join(', ') || 'none'}
- First steps:
${steps || 'No steps available'}
- Citations: ${(guide.source_citations ?? []).map((cite) => cite.title).join(' | ') || 'none'}`);
    }

    return sections.join('\n\n');
}

function buildCitations(
    payload: PartMetadataPayload | null,
    guide: GuideResult | null,
): SourceCitation[] {
    const citations: SourceCitation[] = [];

    if (payload) {
        citations.push({
            title: 'Current scan result context',
            namespace: 'scan_payload',
            relevance_score: 1,
            standard_id: payload.visual_id.part_class,
        });
    }

    for (const cite of guide?.source_citations ?? []) {
        citations.push(cite);
    }

    return citations.slice(0, 5);
}

function buildSuggestedQuestions(
    payload: PartMetadataPayload | null,
    guide: GuideResult | null,
    surface: ChatAssistantRequest['surface'],
): string[] {
    const questions = new Set<string>();

    if (surface === 'scan_result') {
        questions.add('Why did AI classify it this way?');
        questions.add('What hazards matter most here?');
    }

    if (surface === 'guide' || guide) {
        questions.add('What are the first three steps I should follow?');
        questions.add('What PPE or tools are required?');
    }

    if (payload?.material_inference.primary_material) {
        questions.add(`What does the ${normaliseLabel(payload.material_inference.primary_material)} call imply for handling?`);
    }

    if (payload?.hazard_flags.residual_fluid_risk && payload.hazard_flags.residual_fluid_risk !== 'none') {
        questions.add('How should I handle the residual fluid risk?');
    }

    if (!payload && !guide) {
        questions.add('What is the segregation efficiency tier system?');
        questions.add('How much CO₂ is saved by recycling aluminium?');
        questions.add('What are India\'s e-waste disposal rules?');
        questions.add('How does collection route optimization reduce emissions?');
    }

    questions.add('Give me a concise safety summary.');

    return Array.from(questions).slice(0, 4);
}

function buildFallbackAnswer(
    question: string,
    payload: PartMetadataPayload | null,
    guide: GuideResult | null,
): string | null {
    const lower = question.toLowerCase();
    const part = payload ? normaliseLabel(payload.visual_id.part_class) : 'this item';
    const material = payload ? normaliseLabel(payload.material_inference.primary_material) : 'unknown material';
    const fluidRisk = payload ? normaliseLabel(payload.hazard_flags.residual_fluid_risk) : 'none';

    if (question.toLowerCase().includes('ppe') && !payload && !guide) {
        return 'PPE means Personal Protective Equipment. When handling e-waste or general recyclables: always wear protective gloves (chemical-resistant for batteries/PCBs), eye protection, and a dust mask. For pressurised components add a face shield. Dispose of any contaminated PPE as hazardous waste.';
    }

    if (
        lower.includes('rescan') ||
        lower.includes('scan again') ||
        lower.includes('identify this') ||
        lower.includes('upload image')
    ) {
        return 'This assistant answers questions about the current result, safety guides, and circular economy metrics. It does not run a new image scan.';
    }

    // ── Recyclability & Percentage Questions ───────────────────────────────────
    if (
        lower.includes('recyclab') ||
        lower.includes('%') ||
        lower.includes('percent') ||
        lower.includes('fraction') ||
        lower.includes('circular')
    ) {
        return `Recyclability (e.g. 58%) represents the mass fraction of this ${part} that can be recovered into clean, circular material streams (such as the ${material} body and metallic fittings). The remaining portion consists of non-metallic seals (e.g. PTFE seat rings, graphite packing), gaskets, or trapped fluid residue that must be segregated during disassembly to prevent contaminating the recycled alloy.`;
    }

    // ── WRI / Weighted Recyclability Index ────────────────────────────────────
    if (
        lower.includes('wri') ||
        lower.includes('weighted recyclability') ||
        lower.includes('grade a') ||
        lower.includes('grade b') ||
        lower.includes('grade c')
    ) {
        return `WRI (Weighted Recyclability Index) is AI-EcoTrack's circularity metric (0.00 to 1.00) calculated from part identification and alloy classification confidence. It determines the item's recycling grade (Grade A ≥0.85, Grade B 0.65–0.84, Grade C <0.65) and directly dictates sorting efficiency and worker incentive bonus points.`;
    }

    // ── Environmental & CO₂ Impact ────────────────────────────────────────────
    if (
        lower.includes('co2') ||
        lower.includes('carbon') ||
        lower.includes('tree') ||
        lower.includes('plant') ||
        lower.includes('emission')
    ) {
        return `Recovering and recycling ${material} avoids ~2.5 kg of CO₂ per kg of material compared to raw ore mining, refining, and smelting. Every ~21 kg of CO₂ saved is roughly equivalent to the carbon absorbed by one mature tree in a year.`;
    }

    // ── Scrap Valuation & Pricing ─────────────────────────────────────────────
    if (
        lower.includes('value') ||
        lower.includes('price') ||
        lower.includes('cost') ||
        lower.includes('worth') ||
        lower.includes('scrap') ||
        lower.includes('rate') ||
        lower.includes('inr') ||
        lower.includes('rupee') ||
        lower.includes('₹')
    ) {
        return `Recovery scrap valuation is calculated dynamically from the component's estimated mass and live regional spot market rates (e.g. Mumbai MIDC). Segregating Grade A clean single-alloy components (like ${material}) yields maximum market pricing compared to mixed contaminated scrap.`;
    }

    // ── Classification & AI Reasoning ─────────────────────────────────────────
    if (
        lower.includes('why did ai') ||
        lower.includes('why was it classified') ||
        lower.includes('how was it identified') ||
        lower.includes('classify') ||
        lower.includes('confidence')
    ) {
        return `The AI Vision pipeline identified this item as a ${part} (${payload ? Math.round(payload.visual_id.confidence_score * 100) : 99}% confidence) and ${material} (${payload ? Math.round(payload.material_inference.confidence_score * 100) : 95}% confidence) by matching its geometry (flanges, body shape, bonnet, spindle) and surface spectral characteristics against industrial equipment databases and OEM specifications.`;
    }

    // ── Hazards & Safety ──────────────────────────────────────────────────────
    if (lower.includes('hazard') || lower.includes('safe') || lower.includes('ppe') || lower.includes('fluid') || lower.includes('risk')) {
        const isBattery = part.includes('battery') || part.includes('cell') || part.includes('lipo') || part.includes('lithium') || material.includes('lithium') || material.includes('electrolyte');
        if (isBattery) {
            return `For this ${part}: Primary hazards include thermal runaway risk, puncture/short-circuit fire danger, and toxic/corrosive electrolyte leakage. Never crush, incinerate, or short the terminals. Tape exposed leads, store in a fire-safe non-conductive container, and route strictly through authorized battery e-waste recyclers under Battery Waste Management Rules 2022.`;
        }
        const protocols = guide?.safety_protocols.length
            ? guide.safety_protocols.map(normaliseLabel).join(', ')
            : 'standard industrial safety protocols';
        return `${part} is flagged with residual fluid risk "${fluidRisk}". Pressurized component is ${payload?.hazard_flags.pressurized_component ? 'yes' : 'no'}, lead solder is ${payload?.hazard_flags.lead_solder_likelihood ? 'possible' : 'not indicated'}, and asbestos-era risk is ${payload?.hazard_flags.asbestos_era_likelihood ? 'possible' : 'not indicated'}. Follow ${protocols} before handling.`;
    }

    // ── Material / Alloy Details ──────────────────────────────────────────────
    if (lower.includes('material') || lower.includes('alloy')) {
        return `The current result points to ${material}${payload?.material_inference.estimated_alloy_grade ? ` with alloy estimate ${payload.material_inference.estimated_alloy_grade}` : ''}. Material confidence is ${payload ? Math.round(payload.material_inference.confidence_score * 100) : 'unknown'}%, indicating high probability for single-stream circular recovery.`;
    }

    // ── Disassembly Steps ─────────────────────────────────────────────────────
    if (lower.includes('step') || lower.includes('guide') || lower.includes('disassembl') || lower.includes('remove')) {
        const steps = guide?.disassembly_steps.slice(0, 3).map((step) => `${step.step}. ${step.action}`).join(' ');
        if (steps) {
            return `The immediate procedure is: ${steps} Total estimated guide time is ${guide?.estimated_total_time_min ?? 'unknown'} minutes.`;
        }
    }

    if (!payload && !guide) {
        return null;
    }

    return `${part} is identified as ${part} with primary material ${material}. Part confidence is ${payload ? Math.round(payload.visual_id.confidence_score * 100) : 'unknown'}%, and the estimated guide time is ${guide?.estimated_total_time_min ?? 'unknown'} minutes. Ask about recyclability, hazards, material reasoning, or next steps if you want specific details.`;
}

function buildPpeAnswer(
    payload: PartMetadataPayload | null,
    guide: GuideResult | null,
): string {
    const recommendedPpe: string[] = [];
    const risk = payload?.hazard_flags.residual_fluid_risk ?? 'none';

    if (risk === 'chemical_likely') {
        recommendedPpe.push('chemical-resistant gloves', 'face shield', 'respirator', 'chemical-resistant suit');
    } else if (risk === 'hydrocarbon_likely' || risk === 'coolant_likely') {
        recommendedPpe.push('chemical-resistant gloves', 'eye protection');
    } else {
        recommendedPpe.push('protective gloves', 'eye protection');
    }

    if (payload?.hazard_flags.pressurized_component) {
        recommendedPpe.push('face protection for pressurized disassembly');
    }

    const uniquePpe = Array.from(new Set(recommendedPpe));
    const protocols = guide?.safety_protocols.length
        ? ` Follow ${guide.safety_protocols.map(normaliseLabel).join(', ')}.`
        : '';

    return `PPE means Personal Protective Equipment. For this item, use ${uniquePpe.join(', ')} before handling or disassembly.${protocols}`;
}

function getDirectAnswer(
    question: string,
    payload: PartMetadataPayload | null,
    guide: GuideResult | null,
): string | null {
    const normalized = question.toLowerCase().replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim();
    const part = payload ? normaliseLabel(payload.visual_id.part_class) : 'this item';
    const material = payload ? normaliseLabel(payload.material_inference.primary_material) : 'recovered material';

    if (
        normalized === 'ppe' ||
        normalized === 'what is ppe' ||
        normalized === 'whats ppe' ||
        normalized === "what's ppe" ||
        normalized === 'full form of ppe' ||
        normalized === 'what does ppe mean'
    ) {
        return buildPpeAnswer(payload, guide);
    }

    if (
        normalized === 'loto' ||
        normalized === 'what is loto' ||
        normalized === 'whats loto' ||
        normalized === "what's loto" ||
        normalized === 'what does loto mean'
    ) {
        return 'LOTO means Lockout/Tagout. It is the isolation procedure used to de-energize equipment and prevent accidental startup before inspection, maintenance, or disassembly.';
    }

    if (
        normalized === 'dpp' ||
        normalized === 'what is dpp' ||
        normalized === 'whats dpp' ||
        normalized === "what's dpp" ||
        normalized === 'what does dpp mean'
    ) {
        return 'DPP means Digital Product Passport. In this project it is the traceable record of the identified item, its material composition, safety context, and end-of-life handling data.';
    }

    if (
        normalized.includes('58% recyclable') ||
        normalized.includes('meaning of 58%') ||
        normalized.includes('what is the meaning of 58%') ||
        normalized.includes('what does 58% mean') ||
        normalized.includes('what is 58%') ||
        normalized.includes('why 58%')
    ) {
        return `58% Recyclable means that 58% of this ${part}'s total mass consists of recoverable, circular ${material} (body, bonnet, and stem). The remaining 42% consists of consumable internal components (such as PTFE seat rings, graphite packing, and rubber seals) that must be removed during disassembly so they do not contaminate the metal recycling batch.`;
    }

    if (
        normalized === 'wri' ||
        normalized === 'what is wri' ||
        normalized === 'whats wri' ||
        normalized === "what's wri" ||
        normalized === 'wri score' ||
        normalized === 'what is wri score'
    ) {
        return 'WRI stands for Weighted Recyclability Index. It is an index from 0.00 to 1.00 based on AI identification confidence and material purity. An item with WRI ≥0.85 earns Grade A and qualifies for maximum worker incentive points.';
    }

    return null;
}

type ConversationTurn = { role: 'user' | 'assistant'; content: string };

async function generateAssistantAnswer(
    question: string,
    payload: PartMetadataPayload | null,
    guide: GuideResult | null,
    history: ConversationTurn[],
): Promise<string> {
    const directAnswer = getDirectAnswer(question, payload, guide);
    if (directAnswer) return directAnswer;

    const context = buildContextSummary(payload, guide);
    const userMessage = context
        ? `Answer the user's question using the context below and your domain expertise.

CONTEXT
${context}

USER QUESTION
${question}

RESPONSE RULES
- Keep it under 200 words.
- Use plain language.
- Answer simple definition questions directly in the first sentence.
- If safety risk is present, lead with the safety implication.
- If the user asks to scan, identify a new image, or perform actions outside Q&A, explain this assistant is read-only.`
        : `Answer the user's question using your domain expertise in waste management and circular economy.

USER QUESTION
${question}

RESPONSE RULES
- Keep it under 200 words.
- Use plain language.
- Be specific with numbers and regulations when you know them.
- If uncertain about a specific regulation, say so.`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqAvailable = !!(process.env.GROQ_API_KEY_1 ?? process.env.GROQ_API_KEY);

    // Build message history for LLMs (cap at last 6 turns to control token usage)
    const recentHistory = history.slice(-6);

    // ── 1. Gemini Primary (gemini-3.6-flash, gemini-3.7-flash) ─────────────────
    if (geminiKey) {
        const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.7-flash'];
        const genAI = new GoogleGenerativeAI(geminiKey);

        for (const gModel of GEMINI_MODELS) {
            try {
                const model = genAI.getGenerativeModel({ model: gModel });

                const geminiHistory = recentHistory.map(turn => ({
                    role: turn.role === 'assistant' ? 'model' as const : 'user' as const,
                    parts: [{ text: turn.content }],
                }));

                const chat = model.startChat({
                    systemInstruction: SYSTEM_PROMPT,
                    history: geminiHistory,
                });

                const result = await chat.sendMessage(userMessage);
                const answer = result.response.text().trim();
                if (answer) {
                    console.log(`[chat-assistant] Answered via Gemini (${gModel}) ✓`);
                    return answer;
                }
            } catch (error) {
                console.warn(`[chat-assistant] Gemini model ${gModel} failed:`, (error as Error).message);
            }
        }
    }

    // ── 2. Groq Fallback ───────────────────────────────────────────────────────
    if (groqAvailable) {
        const GROQ_TEXT_MODELS = [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
        ];

        for (const modelName of GROQ_TEXT_MODELS) {
            try {
                const res = await groqWithFallback((groq) =>
                    groq.chat.completions.create({
                        model: modelName,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            ...recentHistory.map(turn => ({
                                role: turn.role as 'user' | 'assistant',
                                content: turn.content,
                            })),
                            { role: 'user', content: userMessage },
                        ],
                        temperature: 0.2,
                        max_tokens: 350,
                    }),
                );
                const answer = res.choices[0]?.message?.content?.trim();
                if (answer) {
                    console.log(`[chat-assistant] Answered via Groq (${modelName}) ✓`);
                    return answer;
                }
            } catch (error) {
                console.warn(`[chat-assistant] Groq model ${modelName} failed, trying next:`, (error as Error).message);
            }
        }
    }

    const fallback = buildFallbackAnswer(question, payload, guide);
    return fallback ?? 'This assistant answers questions about the current scan result, materials, and safety guidelines.';
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatAssistantResponse>> {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'chat-assistant',
            limit: 25,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429 },
            );
        }

        const body = (await request.json()) as ChatAssistantRequest;
        const question = body.question?.trim();

        if (!question) {
            return NextResponse.json(
                { success: false, error: 'Question is required.' },
                { status: 400 },
            );
        }

        const payload = body.payload ?? null;
        let guide: GuideResult | null = body.guide ?? null;

        // Allow general eco questions even without a scan context
        if (!guide && payload) {
            guide = await retrieveGuide(payload);
        }

        // Conversation history (up to last 6 turns, provided by client)
        const history: ConversationTurn[] = (body.history ?? []).slice(-6);

        const answer = await generateAssistantAnswer(question, payload, guide, history);
        const citations = buildCitations(payload, guide);
        const suggestedQuestions = buildSuggestedQuestions(payload, guide, body.surface);

        return NextResponse.json({
            success: true,
            answer,
            citations,
            suggested_questions: suggestedQuestions,
        });
    } catch (error) {
        console.error('[chat-assistant] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
