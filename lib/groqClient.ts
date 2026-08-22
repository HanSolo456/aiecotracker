/**
 * Groq key-rotation utility
 * ─────────────────────────
 * Reads GROQ_API_KEY_1, GROQ_API_KEY_2, … (plus the legacy GROQ_API_KEY)
 * and tries each in order.  On a 429 (rate-limit) or 401 (invalid key) it
 * immediately moves to the next key.  Any other error is re-thrown.
 *
 * Usage:
 *   import { groqWithFallback } from '@/lib/groqClient';
 *   const result = await groqWithFallback((groq) =>
 *     groq.chat.completions.create({ ... })
 *   );
 */

import Groq from 'groq-sdk';

/** Collect all configured keys in priority order. */
function getGroqKeys(): string[] {
    const keys: string[] = [];

    // Numbered keys: GROQ_API_KEY_1, GROQ_API_KEY_2, GROQ_API_KEY_3 …
    for (let i = 1; i <= 10; i++) {
        const k = process.env[`GROQ_API_KEY_${i}`];
        if (k) keys.push(k);
    }

    // Legacy / single key last (lowest priority if numbered ones exist)
    const legacy = process.env.GROQ_API_KEY;
    if (legacy && !keys.includes(legacy)) keys.push(legacy);

    return keys;
}

/** Errors that mean "this key is exhausted / wrong — try the next one" */
function isKeyExhausted(err: unknown): boolean {
    if (err && typeof err === 'object') {
        const e = err as { status?: number; statusCode?: number; message?: string; code?: string; type?: string };
        const status = e.status ?? e.statusCode ?? 0;
        // 429 = rate limited, 401 = bad/expired key
        if (status === 429 || status === 401) return true;
        // Stream / connection errors from Groq's vision endpoint
        const code = e.code ?? '';
        const type = e.type ?? '';
        if (
            code === 'ERR_STREAM_PREMATURE_CLOSE' ||
            code === 'ECONNRESET' ||
            code === 'ECONNREFUSED' ||
            type === 'system'
        ) return true;
        // String check for edge cases
        if (typeof e.message === 'string') {
            const msg = e.message.toLowerCase();
            if (
                msg.includes('rate limit') ||
                msg.includes('quota') ||
                msg.includes('invalid api key') ||
                msg.includes('premature close') ||
                msg.includes('premature_close') ||
                msg.includes('invalid response body')
            ) return true;
        }
    }
    return false;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs `fn` with each Groq key in turn, stopping at the first success.
 * On stream/network errors, retries the same key once with a short delay before moving on.
 * Throws if all keys fail or if a non-key-related error occurs.
 */
export async function groqWithFallback<T>(
    fn: (groq: Groq) => Promise<T>
): Promise<T> {
    const keys = getGroqKeys();
    if (keys.length === 0) throw new Error('[groqClient] No GROQ_API_KEY configured.');

    let lastError: unknown;
    for (let i = 0; i < keys.length; i++) {
        // Try each key up to 2 times (once retry on stream drop)
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const groq = new Groq({ apiKey: keys[i] });
                const result = await fn(groq);
                if (i > 0) console.info(`[groqClient] Succeeded with key #${i + 1}`);
                return result;
            } catch (err) {
                if (isKeyExhausted(err)) {
                    const status = (err as { status?: number }).status;
                    const isRateLimit = status === 429 || status === 401;
                    if (attempt === 0 && !isRateLimit) {
                        // Stream/network drop — wait 800ms then retry same key once
                        console.warn(`[groqClient] Key #${i + 1} stream error (attempt 1), retrying in 800ms…`);
                        await sleep(800);
                        lastError = err;
                        continue;
                    }
                    console.warn(`[groqClient] Key #${i + 1} exhausted (${status ?? 'err'}), trying next key…`);
                    lastError = err;
                    break; // move to next key
                }
                throw err; // non-retryable error — surface immediately
            }
        }
    }
    throw lastError ?? new Error('[groqClient] All Groq keys exhausted.');
}

/** Convenience: create a single Groq client using the first available key. */
export function getGroqClient(): Groq {
    const keys = getGroqKeys();
    if (keys.length === 0) throw new Error('[groqClient] No GROQ_API_KEY configured.');
    return new Groq({ apiKey: keys[0] });
}
