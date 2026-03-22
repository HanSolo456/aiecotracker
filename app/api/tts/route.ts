import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/requestRateLimit';
import { GoogleAuth, JWT } from 'google-auth-library';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tts
// Body: { ssml: string; lang?: 'en-US' | 'hi-IN'; voice?: string }
// Returns: audio/mpeg blob
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_TTS_MODEL = 'models/gemini-2.5-pro-preview-tts';
const GCP_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const VOICE_MAP: Record<string, { languageCode: string; name: string }> = {
    'en-US': { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
    'hi-IN': { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-C' },
};

const GOOGLE_TTS_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function stripSsml(input: string): string {
    return input
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function synthesizeWithGcp(
    inputRaw: string,
    lang: string,
    googleTtsKey?: string,
): Promise<{ buffer: Buffer; mimeType: string } | { error: string }> {
    const voice = VOICE_MAP[lang] ?? VOICE_MAP['en-US'];
    const payload = {
        input: { text: inputRaw },
        voice,
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.92,
            pitch: 0,
            effectsProfileId: ['headphone-class-device'],
        },
    };

    const callWithApiKey = async () => {
        if (!googleTtsKey) return null;
        return fetch(`${GCP_TTS_ENDPOINT}?key=${googleTtsKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    };

    const callWithOauth = async () => {
        let token: string | null = null;

        // Prefer explicit Firebase Admin credentials when present.
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
        if (clientEmail && privateKey) {
            const jwt = new JWT({
                email: clientEmail,
                key: privateKey,
                scopes: [GOOGLE_TTS_SCOPE],
            });
            const jwtToken = await jwt.getAccessToken();
            token = typeof jwtToken === 'string' ? jwtToken : (jwtToken?.token ?? null);
        }

        // Fallback to ADC when Firebase Admin env vars are not set.
        if (!token) {
            const auth = new GoogleAuth({ scopes: [GOOGLE_TTS_SCOPE] });
            token = (await auth.getAccessToken()) ?? null;
        }

        if (!token) {
            throw new Error('Failed to obtain Google OAuth access token for TTS fallback.');
        }

        return fetch(GCP_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
    };

    let gcpRes: Response | null = null;
    let apiKeyErrorText = '';

    try {
        gcpRes = await callWithApiKey();

        // If API key is missing/blocked, retry with service-account OAuth.
        if (!gcpRes || gcpRes.status === 401 || gcpRes.status === 403) {
            if (gcpRes && !gcpRes.ok) {
                apiKeyErrorText = await gcpRes.text();
                console.warn(`[TTS] GCP key auth failed (${gcpRes.status}), retrying with OAuth.`);
            }
            gcpRes = await callWithOauth();
        }

        if (!gcpRes.ok) {
            const err = await gcpRes.text();
            console.error('[TTS] GCP fallback error:', err);
            return { error: `GCP fallback failed (${gcpRes.status}).` };
        }

        const { audioContent } = await gcpRes.json() as { audioContent?: string };
        if (!audioContent) {
            return { error: 'GCP fallback returned no audio content.' };
        }

        return { buffer: Buffer.from(audioContent, 'base64'), mimeType: 'audio/mpeg' };
    } catch (err) {
        const baseMessage = err instanceof Error ? err.message : String(err);
        const detail = apiKeyErrorText ? ' Key auth failed with 401/403.' : '';
        console.error('[TTS] GCP fallback exception:', baseMessage, detail);
        return { error: `GCP fallback auth failed.${detail ? ` ${detail}` : ''}` };
    }
}

export async function POST(req: NextRequest) {
    try {
        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'tts',
            limit: 12,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } },
            );
        }

        const body = await req.json() as { ssml?: string; text?: string; lang?: string };
        const lang = body.lang ?? 'en-US';

        const geminiKey = process.env.GEMINI_API_KEY;
        const googleTtsKey = process.env.GOOGLE_TTS_API_KEY;
        if (!geminiKey && !googleTtsKey) {
            return NextResponse.json({ error: 'No TTS key configured (GEMINI_API_KEY or GOOGLE_TTS_API_KEY).' }, { status: 500 });
        }

        const inputRaw = body.ssml ? stripSsml(body.ssml) : (body.text ?? '').trim();
        const inputLength = inputRaw.length;

        if (inputLength === 0) {
            return NextResponse.json({ error: 'Missing text or SSML input.' }, { status: 400 });
        }

        if (inputLength > 8_000) {
            return NextResponse.json({ error: 'TTS input too large. Keep it under 8000 characters.' }, { status: 413 });
        }

        const languageHint = lang === 'hi-IN'
            ? 'Speak naturally in Hindi (India).'
            : 'Speak naturally in English (US).';

        const ttsPrompt = `${languageHint} Read this text clearly and safely for industrial workers:\n\n${inputRaw}`;

        let buffer: Buffer | null = null;
        let mimeType = 'audio/wav';

        if (geminiKey) {
            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${GEMINI_TTS_MODEL}:generateContent?key=${geminiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: ttsPrompt }],
                            },
                        ],
                        generationConfig: {
                            responseModalities: ['audio'],
                        },
                    }),
                },
            );

            if (geminiRes.ok) {
                const payload = await geminiRes.json() as {
                    candidates?: Array<{
                        content?: {
                            parts?: Array<{
                                inlineData?: { data?: string; mimeType?: string };
                            }>;
                        };
                    }>;
                };

                const audioPart = payload.candidates?.[0]?.content?.parts?.find(
                    (part) => !!part.inlineData?.data,
                );

                const base64Audio = audioPart?.inlineData?.data;
                mimeType = audioPart?.inlineData?.mimeType ?? 'audio/wav';

                if (base64Audio) {
                    buffer = Buffer.from(base64Audio, 'base64');
                } else {
                    console.warn('[TTS] Gemini returned 200 but no inline audio payload.');
                }
            } else {
                const err = await geminiRes.text();
                console.warn(`[TTS] Gemini failed with ${geminiRes.status}, trying GCP fallback.`, err);
            }
        }

        if (!buffer) {
            const gcp = await synthesizeWithGcp(inputRaw, lang, googleTtsKey);
            if ('error' in gcp) {
                return NextResponse.json(
                    {
                        error: `Gemini TTS failed and ${gcp.error} Ensure Text-to-Speech API is enabled and service account permissions include Cloud Text-to-Speech User.`,
                    },
                    { status: 502 },
                );
            }

            buffer = gcp.buffer;
            mimeType = gcp.mimeType;
        }

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Length': buffer.length.toString(),
                // Cache identical requests for 1 hour on the edge
                'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            },
        });
    } catch (err) {
        console.error('[TTS] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
