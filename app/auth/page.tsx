'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Mail, Lock, User, Eye, EyeOff, ArrowRight, ChevronLeft } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, registerWithEmail, resetPassword, signInAsGuest } from '@/lib/firebase';
import { consumeGoogleRedirectError } from '@/lib/firebase';
import { isTauriWebview } from '@/lib/isTauriWebview';
import GoogleSignInTauriButton from '@/components/GoogleSignInTauriButton';

type Mode = 'signin' | 'register' | 'reset';

export default function AuthPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [tauriGis, setTauriGis] = useState(false);
    useEffect(() => { setTauriGis(isTauriWebview()); }, []);

    // Post-login routing is handled globally by PostAuthRedirect in AuthProvider.

    function friendlyError(code: string): string {
        const map: Record<string, string> = {
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
            'auth/popup-blocked': 'Opening Google sign-in in this window…',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/unauthorized-domain':
                'This app origin is not allowed for Firebase Auth. In Firebase Console → Authentication → Settings → Authorized domains, add both localhost and 127.0.0.1 (desktop/Tauri uses one or the other).',
            'auth/redirect-no-user':
                'Google sign-in returned without a Firebase session. This is usually an Authorized domains / OAuth config issue in Firebase.',
            'auth/operation-not-allowed':
                'Google provider is disabled in Firebase Authentication → Sign-in method. Enable it and retry.',
            'auth/redirect-failed': 'Google redirect failed before Firebase could complete sign-in.',
        };
        return map[code] ?? 'Something went wrong. Please try again.';
    }

    useEffect(() => {
        const code = consumeGoogleRedirectError();
        if (!code) return;
        setError(friendlyError(code));
    }, []);

    async function handleGoogle() {
        setSubmitting(true); setError('');
        let navigatesAway = false;
        try {
            const result = await signInWithGoogle();
            if (result === 'redirect') {
                navigatesAway = true;
                return;
            }
            // Auth effect will route based on role/org state.
        } catch (e: unknown) {
            const err = e as { code?: string; message?: string };
            console.error('[Google Sign-In error]', err.code, err.message);
            setError(friendlyError(err.code ?? ''));
        } finally {
            if (!navigatesAway) setSubmitting(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true); setError('');
        try {
            if (mode === 'reset') {
                await resetPassword(email);
                setResetSent(true);
            } else if (mode === 'register') {
                await registerWithEmail(email, password, name);
                // Auth effect will route based on role/org state.
            } else {
                await signInWithEmail(email, password);
                // Auth effect will route based on role/org state.
            }
        } catch (e: unknown) {
            const err = e as { code?: string };
            setError(friendlyError(err.code ?? ''));
        } finally { setSubmitting(false); }
    }

    async function handleGuest() {
        setSubmitting(true); setError('');
        try {
            await signInAsGuest();
            router.push('/dashboard');
        } catch (e: unknown) {
            const err = e as { code?: string };
            setError(friendlyError(err.code ?? ''));
        } finally { setSubmitting(false); }
    }

    return (
        <div className="fixed inset-0 overflow-auto z-50" style={{ background: 'var(--bg-primary)' }}>
        <button
            type="button"
            onClick={() => router.replace('/')}
            className="fixed top-4 left-4 z-50 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-90"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            aria-label="Back to home"
        >
            <ChevronLeft size={16} />
        </button>
        <div
            className="min-h-full flex items-center justify-center px-5 py-10"
        >
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[50%] translate-x-[-50%] w-[600px] h-[600px] rounded-full opacity-[0.06]"
                    style={{ background: 'radial-gradient(circle, #84cc16 0%, transparent 70%)' }} />
            </div>

            <div className="relative w-full max-w-sm">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.3)' }}>
                        <Leaf size={26} style={{ color: '#84cc16' }} />
                    </div>
                    <h1 className="font-heading text-2xl font-700 text-white">AI-EcoTrack</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                        {mode === 'signin' ? 'Sign in to your account'
                            : mode === 'register' ? 'Create your account'
                            : 'Reset your password'}
                    </p>
                </div>

                {/* Card */}
                <div className="rounded-2xl p-6" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>

                    {/* Google button */}
                    {mode !== 'reset' && (
                        <>
                            {tauriGis ? (
                                <GoogleSignInTauriButton className="mb-5" />
                            ) : (
                                <button
                                    onClick={handleGoogle}
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-3 rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                                    style={{ background: 'var(--border)', border: '1px solid #374151', color: 'var(--text-primary)' }}
                                >
                                    {/* Google icon SVG */}
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                                        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                                    </svg>
                                    Continue with Google
                                </button>
                            )}

                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
                                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                            </div>
                        </>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        {mode === 'register' && (
                            <div className="relative">
                                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    className="w-full pl-9 pr-4 py-3 rounded-xl text-sm bg-transparent text-white placeholder-[var(--text-muted)] outline-none focus:border-[rgba(132,204,22,0.5)] transition-colors"
                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                />
                            </div>
                        )}

                        <div className="relative">
                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm bg-transparent text-white placeholder-[var(--text-muted)] outline-none focus:border-[rgba(132,204,22,0.5)] transition-colors"
                                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                            />
                        </div>

                        {mode !== 'reset' && (
                            <div className="relative">
                                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-9 pr-10 py-3 rounded-xl text-sm bg-transparent text-white placeholder-[var(--text-muted)] outline-none focus:border-[rgba(132,204,22,0.5)] transition-colors"
                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowPw(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <p className="text-xs px-1" style={{ color: '#F87171' }}>{error}</p>
                        )}

                        {resetSent && (
                            <p className="text-xs px-1" style={{ color: '#84cc16' }}>
                                Password reset email sent! Check your inbox.
                            </p>
                        )}

                        {/* Forgot password link */}
                        {mode === 'signin' && (
                            <button
                                type="button"
                                className="text-xs text-right -mt-1 hover:underline"
                                style={{ color: '#60A5FA' }}
                                onClick={() => { setMode('reset'); setError(''); }}
                            >
                                Forgot password?
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={submitting || (mode === 'reset' && resetSent)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 mt-1"
                            style={{ background: '#84cc16', color: 'var(--bg-primary)' }}
                        >
                            {submitting ? (
                                <span className="w-4 h-4 border-2 border-[var(--bg-primary)] border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'signin' ? 'Sign In'
                                        : mode === 'register' ? 'Create Account'
                                        : 'Send Reset Email'}
                                    <ArrowRight size={15} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Guest option */}
                <div className="mt-3 text-center">
                    <button
                        onClick={handleGuest}
                        disabled={submitting}
                        className="text-sm hover:underline disabled:opacity-50"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Continue as Guest →
                    </button>
                    <p className="text-xs mt-1" style={{ color: '#374151' }}>
                        Org &amp; leaderboard features require an account
                    </p>
                </div>

                {/* Mode switcher */}
                <div className="mt-5 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                    {mode === 'signin' ? (
                        <span>New here?{' '}
                            <button className="font-semibold hover:underline" style={{ color: '#84cc16' }}
                                onClick={() => { setMode('register'); setError(''); }}>
                                Create an account
                            </button>
                        </span>
                    ) : (
                        <span>
                            <button className="font-semibold hover:underline" style={{ color: '#84cc16' }}
                                onClick={() => { setMode('signin'); setError(''); setResetSent(false); }}>
                                ← Back to sign in
                            </button>
                        </span>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
}
