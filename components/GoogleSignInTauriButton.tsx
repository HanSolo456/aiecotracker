'use client';

import { useEffect, useRef, useState } from 'react';
import {
    firebaseReady,
    signInWithGoogle,
    signInWithGoogleIdToken,
} from '@/lib/firebase';
import { isTauriWebview } from '@/lib/isTauriWebview';
import { openExternalUrl } from '@/lib/tauriDesktop';

type Props = {
    /** Tailwind / class for outer wrapper */
    className?: string;
};

/** Firebase redirect only — uses existing NEXT_PUBLIC_FIREBASE_* when no GIS client ID is configured. */
function TauriGoogleRedirectFallback({ className = '' }: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    async function handleClick() {
        setSubmitting(true);
        setError('');
        try {
            const result = await signInWithGoogle();
            if (result === 'redirect') return;
        } catch (e: unknown) {
            const err = e as { code?: string; message?: string };
            const code = err?.code ?? '';
            const msg =
                code === 'auth/unauthorized-domain'
                    ? 'Firebase: add localhost, 127.0.0.1, and (packaged Tauri on Windows) tauri.localhost under Authentication → Settings → Authorized domains.'
                    : code.startsWith('auth/requests-from-referer')
                        ? 'Firebase blocked this app URL (common with packaged Tauri). Prefer tauri dev on localhost, or set NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID for embedded Google sign-in.'
                        : code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request'
                      ? 'Sign-in was interrupted. Please try again.'
                      : code === 'auth/network-request-failed'
                        ? 'Network error. Check your connection and try again.'
                        : code
                          ? `Google sign-in failed (${code}). Try email/password or check Firebase Auth settings.`
                          : 'Google sign-in failed. Try email/password or verify Firebase Auth.';
            setError(msg);
            console.error('[GoogleSignInTauri redirect]', code, err?.message, e);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className={className}>
            {error && (
                <p className="text-xs mb-2 px-1 leading-relaxed" style={{ color: '#F87171' }}>
                    {error}
                </p>
            )}
            <button
                type="button"
                onClick={handleClick}
                disabled={submitting || !firebaseReady}
                className="w-full flex items-center justify-center gap-3 rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--border)', border: '1px solid #374151', color: 'var(--text-primary)' }}
            >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path
                        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                        fill="#4285F4"
                    />
                    <path
                        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                        fill="#34A853"
                    />
                    <path
                        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                        fill="#EA4335"
                    />
                </svg>
                {submitting ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <p className="text-[11px] mt-2 px-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                Uses your Firebase project’s Google sign-in. In Tauri, this uses full-page redirect (popups are blocked by WebView).
            </p>
        </div>
    );
}

/**
 * Google sign-in for Tauri/WebView2.
 * - In Tauri, prefer system-browser Google sign-in when `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
 *   is set. WebView popup flows are brittle and often blocked.
 * - Otherwise: Firebase `signInWithRedirect` using only standard Firebase web config (no extra env).
 */
export default function GoogleSignInTauriButton({ className = '' }: Props) {
    const clientId = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() : '';

    if (isTauriWebview()) {
        if (clientId) {
            return <GoogleIdentityServicesInner className={className} clientId={clientId} />;
        }
        return <TauriGoogleRedirectFallback className={className} />;
    }

    if (!clientId) {
        return <TauriGoogleRedirectFallback className={className} />;
    }

    return <GoogleIdentityServicesInner className={className} clientId={clientId} />;
}

function GoogleIdentityServicesInner({ className, clientId }: Props & { clientId: string }) {
    const activeRequestRef = useRef(true);
    const [submitting, setSubmitting] = useState(false);
    const [hint, setHint] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            activeRequestRef.current = false;
        };
    }, []);

    async function handleClick() {
        setHint(null);
        setSubmitting(true);

        try {
            const createRes = await fetch('/api/desktop-auth/google', {
                method: 'POST',
                cache: 'no-store',
            });
            const handoff = (await createRes.json()) as { requestId?: string; expiresAt?: number; error?: string };

            if (!createRes.ok || !handoff.requestId || !handoff.expiresAt) {
                throw new Error(handoff.error || 'Could not start desktop Google sign-in.');
            }

            const authUrl = new URL('/auth/desktop-google', window.location.origin);
            authUrl.searchParams.set('requestId', handoff.requestId);

            await openExternalUrl(authUrl.toString());

            const maxWaitTime = 5 * 60 * 1000;
            const startTime = Date.now();

            while (Date.now() - startTime < maxWaitTime) {
                await new Promise((resolve) => window.setTimeout(resolve, 1500));

                const pollRes = await fetch(
                    `/api/desktop-auth/google?requestId=${encodeURIComponent(handoff.requestId)}&_t=${Date.now()}`,
                    { cache: 'no-store' },
                );
                const poll = (await pollRes.json().catch(() => null)) as
                    | { status?: string; idToken?: string; error?: string }
                    | null;

                if (!pollRes.ok && poll?.status !== 'expired') {
                    throw new Error(poll?.error || 'Desktop sign-in polling failed.');
                }

                if (poll?.status === 'pending') {
                    continue;
                }

                if (poll?.status === 'completed' && poll.idToken) {
                    try {
                        await signInWithGoogleIdToken(poll.idToken);
                    } catch (fbErr) {
                        throw new Error(`Firebase error: ${fbErr instanceof Error ? fbErr.message : String(fbErr)}`);
                    }

                    if (activeRequestRef.current) {
                        setSubmitting(false);
                    }
                    return;
                }

                if (poll?.status === 'failed') {
                    throw new Error(poll.error || 'Google sign-in failed in the browser.');
                }

                if (poll?.status === 'expired') {
                    throw new Error('Desktop sign-in expired before it completed.');
                }
            }

            throw new Error(`Desktop sign-in timed out. Please try again.`);
        } catch (e) {
            if (activeRequestRef.current) {
                setSubmitting(false);
                setHint(
                    e instanceof Error
                        ? e.message
                        : 'Could not open the browser for Google sign-in.',
                );
            }
        }
    }

    return (
        <div className={className}>
            {hint && (
                <p className="text-xs mb-2 px-1 leading-relaxed" style={{ color: '#F87171' }}>
                    {hint}
                </p>
            )}
            <button
                type="button"
                onClick={handleClick}
                disabled={!firebaseReady || !clientId || submitting}
                className="w-full flex items-center justify-center gap-3 rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--border)', border: '1px solid #374151', color: 'var(--text-primary)' }}
            >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path
                        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                        fill="#4285F4"
                    />
                    <path
                        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                        fill="#34A853"
                    />
                    <path
                        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                        fill="#EA4335"
                    />
                </svg>
                {submitting ? 'Waiting for browser…' : 'Continue with Google'}
            </button>
            <p className="text-[11px] mt-2 px-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                Opens Google sign-in in your default browser, then securely hands the result back to the desktop app.
            </p>
        </div>
    );
}
