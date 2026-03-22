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
        const e = err as { status?: number; statusCode?: number; message?: string };
        const status = e.status ?? e.statusCode ?? 0;
        // 429 = rate limited, 401 = bad/expired key
        if (status === 429 || status === 401) return true;
        // String check for edge cases
        if (typeof e.message === 'string') {
            const msg = e.message.toLowerCase();
            if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('invalid api key')) return true;
        }
    }
    return false;
}

/**
 * Runs `fn` with each Groq key in turn, stopping at the first success.
 * Throws if all keys fail or if a non-key-related error occurs.
 */
export async function groqWithFallback<T>(
    fn: (groq: Groq) => Promise<T>
): Promise<T> {
    const keys = getGroqKeys();
    if (keys.length === 0) throw new Error('[groqClient] No GROQ_API_KEY configured.');

    let lastError: unknown;
    for (let i = 0; i < keys.length; i++) {
        try {
            const groq = new Groq({ apiKey: keys[i] });
            const result = await fn(groq);
            if (i > 0) console.info(`[groqClient] Succeeded with key #${i + 1}`);
            return result;
        } catch (err) {
            if (isKeyExhausted(err)) {
                console.warn(`[groqClient] Key #${i + 1} exhausted (${(err as { status?: number }).status ?? 'err'}), trying next…`);
                lastError = err;
                continue; // try next key
            }
            throw err; // non-key error — surface immediately
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
