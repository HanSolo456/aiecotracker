'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { auth, firebaseReady } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, UserCredential } from 'firebase/auth';

type Step = 'loading' | 'redirecting' | 'verifying' | 'done' | 'error';

export default function DesktopGoogleAuthPage() {
    const searchParams = useSearchParams();
    const urlRequestId = searchParams.get('requestId')?.trim();

    const mountedRef = useRef(true);
    const initiatedRef = useRef(false);
    const [step, setStep] = useState<Step>('loading');
    const [message, setMessage] = useState('Preparing secure login…');

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!firebaseReady) return;
        if (initiatedRef.current) return;
        initiatedRef.current = true;

        async function processHandoff() {
            try {
                const storedRequestId = sessionStorage.getItem('desktop_google_request_id');
                const redirectSent = sessionStorage.getItem('desktop_google_redirect_sent');
                const requestId = urlRequestId || storedRequestId;

                if (!requestId) {
                    setStep('error');
                    setMessage('Missing desktop sign-in request. Go back to the desktop app and try again.');
                    return;
                }

                if (redirectSent) {
                    // We just returned from Google. We are verifying the login.
                    setStep('verifying');
                    setMessage('Checking sign-in status…');
                    
                    // Do NOT immediately remove redirectSent here, because React StrictMode 
                    // will run this twice in dev and kill the second run. 
                    // Wait up to 5 seconds for AuthContext to populate __googleRedirectCredential
                    // or directly call getRedirectResult. Calling it directly is safer here.
                    let redirectCred = await getRedirectResult(auth);
                    
                    if (!redirectCred) {
                        for (let i = 0; i < 50; i++) {
                            redirectCred = (window as any).__googleRedirectCredential;
                            if (redirectCred) break;
                            await new Promise((r) => setTimeout(r, 100));
                        }
                    }

                    if (redirectCred) {
                        setMessage('Authenticating and linking back to desktop…');
                        const credential = GoogleAuthProvider.credentialFromResult(redirectCred);
                        const idToken = await redirectCred.user.getIdToken();

                        if (!idToken) {
                            throw new Error('Google did not return a valid ID token. Try signing in again.');
                        }

                        // Hand it off!
                        const res = await fetch('/api/desktop-auth/google', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ requestId, idToken }),
                        });

                        if (!res.ok) {
                            const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                            throw new Error(payload?.error || `HTTP error ${res.status} when handing off sign-in.`);
                        }

                        sessionStorage.removeItem('desktop_google_request_id');
                        sessionStorage.removeItem('desktop_google_redirect_sent');
                        if (!mountedRef.current) return;
                        setStep('done');
                        setMessage('Google sign-in is complete. Return to the AI-EcoTrack desktop app. This window will close automatically.');
                        setTimeout(() => window.close(), 1500);
                        return;
                    }

                    throw new Error('Sign-in failed or took too long to synchronize. Please try again from the app.');
                }

                // If we haven't sent the redirect yet, send it now
                if (urlRequestId) {
                    setStep('redirecting');
                    setMessage('Forwarding to Google…');
                    sessionStorage.setItem('desktop_google_request_id', urlRequestId);
                    sessionStorage.setItem('desktop_google_redirect_sent', 'true');
                    
                    const provider = new GoogleAuthProvider();
                    provider.setCustomParameters({ prompt: 'select_account' });
                    
                    await signInWithRedirect(auth, provider);
                    return; // execution will leave the page immediately
                }

                // No url param, no redirect cred -> probably a reload.
                throw new Error('Sign-in flow was interrupted. Please try again from the app.');

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error during sign-in.';
                
                const reqId = urlRequestId || sessionStorage.getItem('desktop_google_request_id');
                if (reqId) {
                    await fetch('/api/desktop-auth/google', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requestId: reqId, error: errMsg }),
                    }).catch(() => undefined);
                }

                if (!mountedRef.current) return;
                setStep('error');
                setMessage(`Error: ${errMsg}`);
                sessionStorage.removeItem('desktop_google_request_id');
                sessionStorage.removeItem('desktop_google_redirect_sent');
            }
        }

        void processHandoff();
    }, [urlRequestId, firebaseReady]);

    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-10" style={{ background: 'var(--bg-primary)' }}>
            <div
                className="w-full max-w-md rounded-3xl p-8"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
                <div className="mb-0 text-center">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto"
                        style={{ background: step === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(132,204,22,0.12)', border: `1px solid ${step === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(132,204,22,0.3)'}` }}
                    >
                        {step === 'done' ? (
                            <CheckCircle2 size={32} style={{ color: '#84cc16' }} />
                        ) : (
                            <Loader2 size={32} className={step === 'error' ? '' : 'animate-spin'} style={{ color: step === 'error' ? '#EF4444' : '#84cc16' }} />
                        )}
                    </div>
                    <h1 className="text-2xl font-semibold text-white">AI-EcoTrack</h1>
                    <p className="text-sm mt-3" style={{ color: 'var(--text-dim)' }}>
                        {step === 'error' ? (
                            <span style={{ color: '#FCA5A5' }}>{message}</span>
                        ) : (
                            message
                        )}
                    </p>
                </div>

                {step === 'done' && (
                    <div
                        className="rounded-2xl p-5 text-sm mt-8 text-center"
                        style={{ background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.22)', color: 'var(--text-secondary)' }}
                    >
                        You can close this browser tab now.
                    </div>
                )}
            </div>
        </main>
    );
}
