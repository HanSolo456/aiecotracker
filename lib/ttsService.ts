// ─────────────────────────────────────────────────────────────────────────────
// AI-EcoTrack  ·  TTS Service
// Builds SSML from guide content and manages audio playback state.
// Google Cloud TTS is called via /api/tts (server-side key, never exposed).
// ─────────────────────────────────────────────────────────────────────────────

import type { GuideResult } from '@/types';

export type TtsStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// ── SSML Builder ─────────────────────────────────────────────────────────────

// ── Phrases ──────────────────────────────────────────────────────────────────
const PHRASES = {
    en: {
        warning:        'Warning! Hazard detected.',
        mandatorySteps: 'Please complete the following mandatory safety steps before proceeding.',
        stepLabel:      (n: number) => `Step ${n}.`,
        onlyProceed:    'Only proceed after all hazard steps are confirmed.',
        guideIntro:     (steps: number, mins: number | null) =>
            `Disassembly guide. ${steps} steps.${mins ? ` Estimated time: ${mins} minutes.` : ''}`,
        safetyRequired: 'Safety protocols required.',
        beginning:      'Beginning disassembly procedure.',
        caution:        (ref: string) => `Caution — safety reference: ${ref}.`,
        complete:       'Disassembly guide complete.',
    },
    hi: {
        warning:        'चेतावनी! खतरा पाया गया।',
        mandatorySteps: 'कृपया आगे बढ़ने से पहले निम्न अनिवार्य सुरक्षा चरण पूरे करें।',
        stepLabel:      (n: number) => `चरण ${n}.`,
        onlyProceed:    'सभी खतरे के चरण पुष्टि होने के बाद ही आगे बढ़ें।',
        guideIntro:     (steps: number, mins: number | null) =>
            `डिसएसेंबली गाइड। ${steps} चरण।${mins ? ` अनुमानित समय: ${mins} मिनट।` : ''}`,
        safetyRequired: 'सुरक्षा प्रोटोकॉल आवश्यक हैं।',
        beginning:      'डिसएसेंबली प्रक्रिया शुरू हो रही है।',
        caution:        (ref: string) => `सावधान — सुरक्षा संदर्भ: ${ref}.`,
        complete:       'डिसएसेंबली गाइड पूर्ण।',
    },
};

/**
 * Build an SSML string for the full guide.
 *  - lang: 'en' | 'hi' — controls narrator phrases (step content stays English)
 *  - Hazardous fluid warning → spoken loudly with emphasis (if present)
 *  - Safety protocols       → spoken clearly with a short pause before each
 *  - Each disassembly step  → numbered, with safety_ref spoken loudly
 */
export function buildGuideSSML(
    guide: GuideResult,
    hazardTitle?: string,
    hazardSteps?: string[],
    lang: 'en' | 'hi' = 'en',
): string {
    const p = PHRASES[lang] ?? PHRASES.en;
    const parts: string[] = [];

    // ── Hazard preamble (spoken loudly) ──────────────────────────────────────
    if (hazardTitle && hazardSteps?.length) {
        parts.push(`
<emphasis level="strong">
  <prosody volume="loud" rate="slow">${p.warning} ${hazardTitle}.</prosody>
</emphasis>
<break time="600ms"/>
<prosody volume="loud">
  ${p.mandatorySteps}
  <break time="400ms"/>
  ${hazardSteps.map((s, i) => `${p.stepLabel(i + 1)} ${s}`).join('<break time="350ms"/>  ')}
</prosody>
<break time="800ms"/>
<prosody volume="loud" rate="slow">${p.onlyProceed}</prosody>
<break time="1000ms"/>`);
    }

    // ── Disassembly guide intro ───────────────────────────────────────────────
    const totalSteps = guide.disassembly_steps?.length ?? 0;
    const totalTime  = guide.estimated_total_time_min;
    parts.push(`${p.guideIntro(totalSteps, totalTime)}<break time="500ms"/>`);

    // ── Safety protocols ─────────────────────────────────────────────────────
    if (guide.safety_protocols?.length) {
        parts.push(`
<emphasis level="moderate">${p.safetyRequired}</emphasis>
<break time="300ms"/>
${guide.safety_protocols.map(pr => pr.replace(/_/g, ' ')).join('<break time="250ms"/> ')}
<break time="700ms"/>`);
    }

    // ── Disassembly steps ────────────────────────────────────────────────────
    parts.push(`${p.beginning}<break time="400ms"/>`);

    for (const step of (guide.disassembly_steps ?? [])) {
        const hasSafetyRef = !!step.safety_ref;
        if (hasSafetyRef) {
            parts.push(`
<break time="300ms"/>
<emphasis level="strong">
  <prosody volume="loud">${p.stepLabel(step.step)} ${p.caution(step.safety_ref?.replace(/_/g, ' ') ?? '')}
  </prosody>
</emphasis>
<break time="250ms"/>
${step.action}
<break time="350ms"/>`);
        } else {
            parts.push(`
<break time="300ms"/>
${p.stepLabel(step.step)} ${step.action}
${step.tool_required ? `Tool required: ${step.tool_required.replace(/_/g, ' ')}.` : ''}
${step.estimated_time_min ? `Estimated time: ${step.estimated_time_min} minutes.` : ''}
<break time="300ms"/>`);
        }
    }

    parts.push(`<break time="400ms"/>${p.complete}`);

    return `<speak>${parts.join('\n')}</speak>`;
}


// ── Audio Player ─────────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;

/**
 * Fetch audio from /api/tts and return an HTMLAudioElement.
 * Previous audio (if any) is stopped first.
 */
export async function fetchTtsAudio(ssml: string, lang: string): Promise<HTMLAudioElement> {
    // Stop any existing playback
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }

    const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssml, lang }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error((err as { error: string }).error ?? `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);

    // Clean up object URL when audio is done
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    currentAudio = audio;
    return audio;
}

/** Stop the currently playing TTS audio immediately. */
export function stopTts(): void {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
}
