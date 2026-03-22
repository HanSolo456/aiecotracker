'use client';

import { useEffect, useRef, useState } from 'react';
import { firebaseReady, signInWithGoogle, signInWithGoogleIdToken } from '@/lib/firebase';
import { loadGoogleIdentityScript } from '@/lib/loadGoogleIdentityScript';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential: string }) => void;
                        auto_select?: boolean;
                        cancel_on_tap_outside?: boolean;
                    }) => void;
                    renderButton: (
                        parent: HTMLElement,
                        options: {
                            type?: string;
                            theme?: string;
                            size?: string;
                            text?: string;
                            width?: string | number;
                            locale?: string;
                        },
                    ) => void;
                };
            };
        };
    }
}

type Props = {
    /** Tailwind / class for outer wrapper */
    className?: string;
};

/** Firebase redirect only — uses existing NEXT_PUBLIC_FIREBASE_* (no separate Google OAuth client ID). */
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
                Uses your Firebase project’s Google sign-in (full-page redirect). Optional later: add{' '}
                <code className="text-[10px]">NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID</code> for the embedded Google button.
            </p>
        </div>
    );
}

/**
 * Google sign-in for Tauri/WebView2.
 * - If `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is set: Google Identity Services + Firebase credential (smoother in WebView).
 * - Otherwise: Firebase `signInWithRedirect` using only standard Firebase web config (no extra env).
 */
export default function GoogleSignInTauriButton({ className = '' }: Props) {
    const clientId = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() : '';

    if (!clientId) {
        return <TauriGoogleRedirectFallback className={className} />;
    }

    return <GoogleIdentityServicesInner className={className} clientId={clientId} />;
}

function GoogleIdentityServicesInner({ className, clientId }: Props & { clientId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hint, setHint] = useState<string | null>(null);

    useEffect(() => {
        if (!firebaseReady) return;

        let cancelled = false;
        const el = containerRef.current;
        if (!el) return;

        void (async () => {
            try {
                await loadGoogleIdentityScript();
                if (cancelled || !containerRef.current) return;

                el.innerHTML = '';

                window.google!.accounts.id.initialize({
                    client_id: clientId,
                    callback: async (response) => {
                        try {
                            await signInWithGoogleIdToken(response.credential);
                        } catch (e) {
                            console.error('[GoogleSignInTauri]', e);
                            setHint('Google sign-in failed. Check OAuth client ID and authorized origins in Google Cloud Console.');
                        }
                    },
                });

                window.google!.accounts.id.renderButton(containerRef.current, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text: 'continue_with',
                    width: '100%',
                });
            } catch (e) {
                console.error(e);
                if (!cancelled) setHint('Could not load Google Sign-In.');
            }
        })();

        return () => {
            cancelled = true;
            if (el) el.innerHTML = '';
        };
    }, [clientId]);

    return (
        <div className={className}>
            {hint && (
                <p className="text-xs mb-2 px-1 leading-relaxed" style={{ color: '#F87171' }}>
                    {hint}
                </p>
            )}
            <div ref={containerRef} className="min-h-[44px] w-full flex items-center justify-center [&_iframe]:!w-full" />
        </div>
    );
}
