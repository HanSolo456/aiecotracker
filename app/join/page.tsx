'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Leaf, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getInvite, redeemInvite, type Invite } from '@/lib/inviteService';
import { signInWithGoogle, signInWithEmail, registerWithEmail } from '@/lib/firebase';
import { isTauriWebview } from '@/lib/isTauriWebview';
import GoogleSignInTauriButton from '@/components/GoogleSignInTauriButton';

type Step = 'loading' | 'auth' | 'redeeming' | 'done' | 'error';
type AuthMode = 'signin' | 'register';

function JoinPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading, refreshProfile } = useAuth();

    const code = searchParams.get('code') ?? '';

    const [step, setStep] = useState<Step>('loading');
    const [invite, setInvite] = useState<Invite | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [authMode, setAuthMode] = useState<AuthMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [tauriGis, setTauriGis] = useState(false);
    useEffect(() => { setTauriGis(isTauriWebview()); }, []);

    // 1. Validate invite code on mount
    useEffect(() => {
        if (!code) { setErrorMsg('No invite code found in the link.'); setStep('error'); return; }
        getInvite(code).then(inv => {
            if (!inv) { setErrorMsg('This invite link is invalid.'); setStep('error'); return; }
            const expires = (inv.expiresAt as unknown as { toDate?: () => Date }).toDate?.() ?? new Date(0);
            if (new Date() > expires) { setErrorMsg('This invite link has expired.'); setStep('error'); return; }
            if (inv.usedBy) { setErrorMsg('This invite link has already been used.'); setStep('error'); return; }
            setInvite(inv);
            setStep('auth');
        }).catch(() => { setErrorMsg('Failed to load invite. Please try again.'); setStep('error'); });
    }, [code]);

    // 2. Once user is authed, redeem the invite
    useEffect(() => {
        if (authLoading || !user || !invite || step !== 'auth') return;
        // If user already has an org, just go home
        setStep('redeeming');
        redeemInvite(code, user.uid)
            .then(async () => {
                await refreshProfile();
                setStep('done');
                setTimeout(() => router.replace('/dashboard'), 2000);
            })
            .catch(e => {
                const msg = e.message === 'invite-already-used'
                    ? 'This invite was already used by another account.'
                    : e.message === 'invite-expired'
                        ? 'This invite has expired.'
                        : 'Failed to join organisation. Please try again.';
                setErrorMsg(msg);
                setStep('error');
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, invite, step]);

    async function handleGoogle() {
        setSubmitting(true);
        let navigatesAway = false;
        try {
            const result = await signInWithGoogle();
            if (result === 'redirect') {
                navigatesAway = true;
                return;
            }
        } catch {
            setErrorMsg('Google sign-in failed. Please try again.');
        } finally {
            if (!navigatesAway) setSubmitting(false);
        }
    }

    async function handleEmailAuth(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (authMode === 'register') await registerWithEmail(email, password, name);
            else await signInWithEmail(email, password);
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            setErrorMsg(
                code === 'auth/user-not-found' ? 'No account with this email.' :
                    code === 'auth/wrong-password' ? 'Incorrect password.' :
                        code === 'auth/email-already-in-use' ? 'Email already in use.' :
                            'Authentication failed. Please try again.'
            );
        } finally { setSubmitting(false); }
    }

    // ── Render states ──────────────────────────────────────────────────────────

    if (step === 'loading') return <Shell><Spinner /></Shell>;

    if (step === 'error') return (
        <Shell>
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <XCircle size={28} style={{ color: '#EF4444' }} />
                </div>
                <h1 className="text-xl font-bold text-white">Invalid Invite</h1>
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{errorMsg}</p>
                <button onClick={() => router.replace('/dashboard')}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
                    Go to Dashboard
                </button>
            </div>
        </Shell>
    );

    if (step === 'redeeming') return (
        <Shell>
            <div className="flex flex-col items-center gap-4 text-center">
                <Spinner />
                <p className="text-sm text-white">Joining <strong>{invite?.orgName}</strong>…</p>
            </div>
        </Shell>
    );

    if (step === 'done') return (
        <Shell>
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(132,204,22,0.1)' }}>
                    <CheckCircle size={28} style={{ color: '#84cc16' }} />
                </div>
                <h1 className="text-xl font-bold text-white">You&apos;re in!</h1>
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Welcome to <strong className="text-white">{invite?.orgName}</strong>. Taking you to the dashboard…</p>
            </div>
        </Shell>
    );

    // step === 'auth'
    return (
        <Shell>
            <div className="w-full max-w-sm mx-auto">
                {/* Org card */}
                {invite && (
                    <div className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3"
                        style={{ background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.25)' }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm"
                            style={{ background: 'rgba(132,204,22,0.15)' }}>🏭</div>
                        <div>
                            <p className="text-xs" style={{ color: '#84cc16' }}>You&apos;re invited to</p>
                            <p className="text-sm font-bold text-white">{invite.orgName}</p>
                        </div>
                    </div>
                )}

                <h1 className="text-xl font-bold text-white mb-1">
                    {authMode === 'register' ? 'Create an account' : 'Sign in to join'}
                </h1>
                <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
                    Sign in or create a new account to accept this invite.
                </p>

                {errorMsg && (
                    <div className="mb-4 rounded-xl px-3 py-2.5 text-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                        {errorMsg}
                    </div>
                )}

                {/* Google — Tauri uses GIS + credential (redirect/popup break in WebView) */}
                {tauriGis ? (
                    <GoogleSignInTauriButton className="mb-4" />
                ) : (
                    <button onClick={handleGoogle} disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold mb-4 transition-all hover:opacity-90"
                        style={{ background: '#fff', color: 'var(--bg-card)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        Continue with Google
                    </button>
                )}

                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-xs" style={{ color: '#374151' }}>or</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                </div>

                <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
                    {authMode === 'register' && (
                        <input className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white"
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                            placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
                    )}
                    <input type="email" className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                        placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <input type="password" className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                        placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="submit" disabled={submitting}
                        className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                        style={{ background: '#84cc16', color: 'var(--bg-primary)' }}>
                        {submitting ? 'Please wait…' : authMode === 'register' ? 'Create Account & Join' : 'Sign In & Join'}
                    </button>
                </form>

                <p className="mt-4 text-center text-xs" style={{ color: '#4B5563' }}>
                    {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                    <button onClick={() => { setAuthMode(authMode === 'signin' ? 'register' : 'signin'); setErrorMsg(''); }}
                        className="underline" style={{ color: '#60A5FA' }}>
                        {authMode === 'signin' ? 'Create one' : 'Sign in'}
                    </button>
                </p>
            </div>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 overflow-auto z-50" style={{ background: 'var(--bg-primary)' }}>
            <div className="min-h-full flex items-center justify-center p-5">
                <div className="w-full max-w-sm">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)' }}>
                            <Leaf size={15} style={{ color: '#84cc16' }} />
                        </div>
                        <span className="font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>AI-EcoTrack</span>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
        </div>
    );
}

export default function JoinPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
            </div>
        }>
            <JoinPageInner />
        </Suspense>
    );
}
