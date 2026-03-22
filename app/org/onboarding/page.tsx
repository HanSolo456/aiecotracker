'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Building2, Plus, QrCode, Hash, ArrowRight, CheckCircle, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { redeemInvite } from '@/lib/inviteService';

type Panel = 'choice' | 'join' | 'scanning' | 'joining' | 'done';

type BarcodeDetectorLike = new (options: { formats: string[] }) => {
    detect: (input: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export default function OrgOnboardingPage() {
    const router = useRouter();
    const { user, profile, loading, refreshProfile } = useAuth();
    const [panel, setPanel] = useState<Panel>('choice');
    const [code, setCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [orgName, setOrgName] = useState('');

    // QR scanner refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);

    // Route superadmin to superadmin console; org-linked users to dashboard.
    useEffect(() => {
        if (loading) return;
        if (profile?.role === 'superadmin') {
            router.replace('/superadmin/factory-devices');
            return;
        }
        if (profile?.orgId) router.replace('/dashboard');
    }, [loading, profile, router]);

    // Stop camera stream on unmount or panel change
    useEffect(() => {
        return () => stopCamera();
    }, []);

    function stopCamera() {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }

    // Start live QR scan
    const startQrScan = useCallback(async () => {
        if (!('BarcodeDetector' in window)) {
            setErrorMsg('Live QR scanning is not supported in your browser. Please enter the code manually.');
            setPanel('join');
            return;
        }
        setPanel('scanning');
        setErrorMsg('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
            });
            streamRef.current = stream;
            // Wait for video element to mount
            await new Promise<void>(resolve => setTimeout(resolve, 100));
            const video = videoRef.current;
            if (!video) { stopCamera(); return; }
            video.srcObject = stream;
            await video.play();

            const BarcodeDetectorCtor = (window as Window & { BarcodeDetector?: BarcodeDetectorLike }).BarcodeDetector;
            if (!BarcodeDetectorCtor) {
                setErrorMsg('QR scanning is not supported on this device/browser.');
                stopCamera();
                return;
            }
            const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });

            async function scanFrame() {
                if (!video || !streamRef.current) return;
                try {
                    const results = await detector.detect(video);
                    if (results.length > 0) {
                        const raw = results[0].rawValue as string;
                        const match = raw.match(/[?&]code=([A-Z0-9]+)/i);
                        const extracted = match ? match[1].toUpperCase() : raw.trim().toUpperCase();
                        stopCamera();
                        setCode(extracted);
                        setPanel('join');
                        return;
                    }
                } catch { /* frame not ready */ }
                rafRef.current = requestAnimationFrame(scanFrame);
            }
            rafRef.current = requestAnimationFrame(scanFrame);
        } catch {
            stopCamera();
            setErrorMsg('Camera access was denied. Please enter the code manually.');
            setPanel('join');
        }
    }, []);

    function cancelScan() {
        stopCamera();
        setPanel('join');
    }

    async function handleJoin() {
        if (!user || !code.trim()) return;
        setPanel('joining');
        setErrorMsg('');
        try {
            const result = await redeemInvite(code.trim().toUpperCase(), user.uid);
            setOrgName(result.orgName);
            await refreshProfile();
            setPanel('done');
            setTimeout(() => router.replace('/dashboard'), 2000);
        } catch (e: unknown) {
            const msg = (e as Error).message;
            setErrorMsg(
                msg === 'invite-expired' ? 'This invite link has expired.' :
                    msg === 'invite-already-used' ? 'This invite has already been used.' :
                        msg === 'invite-not-found' ? 'Invalid invite code. Please check and try again.' :
                            `Failed to join. (${msg})`
            );
            setPanel('join');
        }
    }

    if (loading) return <Shell><Spinner /></Shell>;

    // ── Live Scanner ───────────────────────────────────────────────────────────
    if (panel === 'scanning') return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
            {/* Viewfinder */}
            <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Overlay */}
            <div className="relative z-10 flex flex-col h-full">
                {/* Top bar */}
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <span className="text-white font-semibold text-sm">Scan Invite QR Code</span>
                    <button onClick={cancelScan}
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <X size={18} color="#fff" />
                    </button>
                </div>

                {/* Scan box cutout */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="relative w-64 h-64">
                        {/* Dimmed corners */}
                        <div className="absolute inset-0 rounded-2xl"
                            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }} />
                        {/* Corner brackets */}
                        {[['top-0 left-0', 'border-t-2 border-l-2 rounded-tl-xl'],
                        ['top-0 right-0', 'border-t-2 border-r-2 rounded-tr-xl'],
                        ['bottom-0 left-0', 'border-b-2 border-l-2 rounded-bl-xl'],
                        ['bottom-0 right-0', 'border-b-2 border-r-2 rounded-br-xl']].map(([pos, cls]) => (
                            <div key={pos} className={`absolute w-8 h-8 ${pos} ${cls}`}
                                style={{ borderColor: '#84cc16' }} />
                        ))}
                        {/* Scanning line */}
                        <div className="absolute left-0 right-0 h-0.5 animate-scan-line"
                            style={{ background: 'rgba(132,204,22,0.7)', top: '50%' }} />
                    </div>
                </div>

                {/* Bottom hint */}
                <div className="px-8 pb-16 text-center">
                    <p className="text-white text-sm opacity-80">Point your camera at the QR code</p>
                    <button onClick={cancelScan}
                        className="mt-4 text-sm underline"
                        style={{ color: '#84cc16' }}>
                        Enter code manually instead
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Done ──────────────────────────────────────────────────────────────────
    if (panel === 'done') return (
        <Shell>
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(132,204,22,0.1)' }}>
                    <CheckCircle size={28} style={{ color: '#84cc16' }} />
                </div>
                <h1 className="text-xl font-bold text-white">You&apos;re in!</h1>
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                    Welcome to <strong className="text-white">{orgName}</strong>. Taking you to the dashboard…
                </p>
            </div>
        </Shell>
    );

    // ── Joining spinner ────────────────────────────────────────────────────────
    if (panel === 'joining') return (
        <Shell>
            <div className="flex flex-col items-center gap-4 text-center">
                <Spinner />
                <p className="text-sm text-white">Joining organisation…</p>
            </div>
        </Shell>
    );

    return (
        <Shell>
            <div className="w-full max-w-sm mx-auto">
                <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Space Grotesk' }}>
                    Welcome 👋
                </h1>
                <p className="text-sm mb-8" style={{ color: 'var(--text-dim)' }}>
                    Would you like to join an existing organisation or create a new one?
                </p>

                {/* ── Choice panel ─────────────────────────────────────────────── */}
                {panel === 'choice' && (
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => setPanel('join')}
                            className="flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all hover:opacity-90 active:scale-[0.98]"
                            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' }}
                        >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(96,165,250,0.15)' }}>
                                <Building2 size={18} style={{ color: '#60A5FA' }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-white">Join an Organisation</p>
                                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Use an invite QR or code from your admin</p>
                            </div>
                            <ArrowRight size={16} style={{ color: '#374151' }} />
                        </button>

                        <button
                            onClick={() => router.push('/org/setup')}
                            className="flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all hover:opacity-90 active:scale-[0.98]"
                            style={{ background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.25)' }}
                        >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(132,204,22,0.15)' }}>
                                <Plus size={18} style={{ color: '#84cc16' }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-white">Create a New Organisation</p>
                                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Set up your org as an admin</p>
                            </div>
                            <ArrowRight size={16} style={{ color: '#374151' }} />
                        </button>

                        <button
                            onClick={() => router.replace('/dashboard')}
                            className="mt-1 text-center text-xs py-2"
                            style={{ color: '#374151' }}
                        >
                            Skip for now — use as personal account
                        </button>
                    </div>
                )}

                {/* ── Join panel ───────────────────────────────────────────────── */}
                {panel === 'join' && (
                    <div className="flex flex-col gap-4">
                        {errorMsg && (
                            <div className="rounded-xl px-4 py-3 text-sm"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                                {errorMsg}
                            </div>
                        )}

                        {/* Scan QR — opens live viewfinder */}
                        <button
                            onClick={startQrScan}
                            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
                            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60A5FA' }}
                        >
                            <QrCode size={16} />
                            Scan Invite QR Code
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                            <span className="text-xs" style={{ color: '#374151' }}>or enter code manually</span>
                            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                        </div>

                        <div className="relative">
                            <Hash size={15} className="absolute left-3 top-3.5" style={{ color: 'var(--text-dim)' }} />
                            <input
                                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none text-white tracking-widest font-mono uppercase"
                                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                placeholder="e.g. A1B2C3"
                                value={code}
                                maxLength={10}
                                onChange={e => setCode(e.target.value.toUpperCase())}
                            />
                        </div>

                        <button
                            disabled={code.trim().length < 4}
                            onClick={handleJoin}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all"
                            style={{
                                background: code.trim().length >= 4 ? '#84cc16' : 'var(--border)',
                                color: code.trim().length >= 4 ? 'var(--bg-primary)' : '#4B5563',
                                cursor: code.trim().length >= 4 ? 'pointer' : 'not-allowed',
                            }}
                        >
                            <ArrowRight size={15} />
                            Join Organisation
                        </button>

                        <button
                            onClick={() => { setPanel('choice'); setCode(''); setErrorMsg(''); }}
                            className="text-center text-xs py-1"
                            style={{ color: '#374151' }}
                        >
                            ← Back
                        </button>
                    </div>
                )}
            </div>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 overflow-auto z-50" style={{ background: 'var(--bg-primary)' }}>
            <div className="min-h-full flex items-center justify-center p-5">
                <div className="w-full max-w-sm">
                    <div className="flex items-center gap-2 mb-10">
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
            <Loader2 size={28} className="animate-spin" style={{ color: '#84cc16' }} />
        </div>
    );
}
