'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, X, ChevronLeft, Zap, Plus, Layers, SwitchCamera } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import type { DigitalProductPassport, PartMetadataPayload } from '@/types';
import { saveScan, type ScanContext } from '@/lib/scanService';
import { enqueueOfflineScan, flushOfflineQueue, getOfflineQueueSize } from '@/lib/offlineQueue';
import { useAuth } from '@/lib/authContext';
import { setSessionJSON, setSessionValue } from '@/lib/sessionState';
import { useLanguage } from '@/components/LanguageProvider';

type ScanState = 'idle' | 'analysing' | 'done' | 'error' | 'no_match';

interface CapturedAngle {
    dataUrl: string;
    label: string;
}

const ANGLE_LABELS = ['Front View', 'Side View', 'Top / Detail'];

const ANALYSIS_STEPS = [
    'Initialising VLM inference engine…',
    'Analysing angle 1 — part class detection…',
    'Analysing angle 2 — material inference…',
    'Analysing angle 3 — geometry & surface…',
    'Merging multi-view results…',
    'Running Safety Gatekeeper rules…',
    'Generating Digital Product Passport…',
];

export default function ScanPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const { user, profile } = useAuth();
    const fileRef = useRef<HTMLInputElement>(null);
    const activeSlotRef = useRef<number>(0);

    const [angles, setAngles] = useState<(CapturedAngle | null)[]>([null, null, null]);
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [analysisStep, setAnalysisStep] = useState(0);
    const [offlineQueued, setOfflineQueued] = useState(false);
    const [pendingOffline, setPendingOffline] = useState(0);

    // Flush any pending offline scans when we come back online
    useEffect(() => {
        const size = getOfflineQueueSize();
        if (size > 0) setPendingOffline(size);

        async function tryFlush() {
            if (!navigator.onLine) return;
            const uploaded = await flushOfflineQueue();
            if (uploaded > 0) {
                setPendingOffline(getOfflineQueueSize());
            }
        }
        tryFlush();
        window.addEventListener('online', tryFlush);
        return () => window.removeEventListener('online', tryFlush);
    }, []);


    // ── Camera viewfinder state ───────────────────────────────────────────────
    const [cameraOpen, setCameraOpen] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }, []);

    const startCamera = useCallback(async (facing: 'environment' | 'user') => {
        stopStream();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch {
            setError('Camera access denied. Please allow camera permission and try again.');
            setCameraOpen(false);
        }
    }, [stopStream]);

    const openCamera = useCallback((slotIndex: number) => {
        activeSlotRef.current = slotIndex;
        setCameraOpen(true);
    }, []);

    const closeCamera = useCallback(() => {
        stopStream();
        setCameraOpen(false);
    }, [stopStream]);

    const flipCamera = useCallback(() => {
        const next = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(next);
        startCamera(next);
    }, [facingMode, startCamera]);

    const capturePhoto = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setAngles(prev => {
            const next = [...prev];
            next[activeSlotRef.current] = {
                dataUrl,
                label: ANGLE_LABELS[activeSlotRef.current],
            };
            return next;
        });
        closeCamera();
    }, [closeCamera]);

    // Start stream when modal opens
    useEffect(() => {
        if (cameraOpen) startCamera(facingMode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameraOpen]);

    const filledAngles = angles.filter(Boolean) as CapturedAngle[];

    // ── Open file picker for a specific slot ─────────────────────────────────
    const openPickerForSlot = useCallback((slotIndex: number) => {
        activeSlotRef.current = slotIndex;
        fileRef.current?.click();
    }, []);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset value so same file can be re-selected
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setAngles(prev => {
                const next = [...prev];
                next[activeSlotRef.current] = {
                    dataUrl,
                    label: ANGLE_LABELS[activeSlotRef.current],
                };
                return next;
            });
        };
        reader.readAsDataURL(file);
    }, []);

    const removeAngle = useCallback((index: number) => {
        setAngles(prev => {
            const next = [...prev];
            next[index] = null;
            return next;
        });
    }, []);

    // ── Image compression ─────────────────────────────────────────────────────
    // Groq vision API rejects payloads >4 MB. Resize to max 1024px and re-encode
    // as JPEG @ 0.75 quality before sending — keeps every image well under 300 KB.
    const compressImage = (dataUrl: string, maxPx = 1024, quality = 0.75): Promise<string> =>
        new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = dataUrl;
        });

    // ── Run multi-view analysis ───────────────────────────────────────────────
    const runAnalysis = useCallback(async (imagesToAnalyse: CapturedAngle[]) => {
        setScanState('analysing');
        setAnalysisStep(0);
        setError(null);

        const stepInterval = setInterval(() => {
            setAnalysisStep(prev => {
                if (prev >= ANALYSIS_STEPS.length - 1) { clearInterval(stepInterval); return prev; }
                return prev + 1;
            });
        }, 700);

        try {
            // Compress each image to stay under Groq's 4 MB request limit
            const compressed = await Promise.all(
                imagesToAnalyse.map(a => compressImage(a.dataUrl))
            );
            const images = compressed.map(dataUrl => ({
                // Strip the data:image/...;base64, prefix — send raw base64 only
                imageBase64: dataUrl.replace(/^data:image\/[a-z+]+;base64,/, ''),
                mimeType: 'image/jpeg',
            }));

            // Step 1: Multi-view part identification
            const identifyRes = await fetch('/api/identify-part-multiview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images }),
            });
            const identifyData = await identifyRes.json() as { success: boolean; payload?: PartMetadataPayload; mock?: boolean; error?: string };
            if (!identifyRes.ok || !identifyData.success || !identifyData.payload) {
                throw new Error(identifyData.error ?? 'Part identification failed');
            }

            // ── Confidence gate ───────────────────────────────────────────
            // If Groq can't identify the part (unknown class or confidence < 35%),
            // stop here — don't generate a fabricated guide or passport.
            const { visual_id } = identifyData.payload;
            const isUnknown = visual_id.part_class === 'unknown' || visual_id.confidence_score < 0.35;
            if (isUnknown && !identifyData.mock) {
                clearInterval(stepInterval);
                setScanState('no_match');
                return;
            }

            // Step 2: Retrieve guide
            const guideRes = await fetch('/api/retrieve-guide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(identifyData.payload),
            });
            const guideData = await guideRes.json() as { success: boolean; guide?: unknown; error?: string };
            if (!guideRes.ok || !guideData.success) {
                throw new Error(guideData.error ?? 'Guide retrieval failed');
            }

            // Step 3: Generate DPP
            const dppRes = await fetch('/api/generate-dpp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partPayload: identifyData.payload, guideResult: guideData.guide }),
            });
            const dppData = await dppRes.json() as { success: boolean; dpp?: DigitalProductPassport; error?: string };
            if (!dppRes.ok || !dppData.success || !dppData.dpp) {
                throw new Error(dppData.error ?? 'Digital Product Passport generation failed');
            }

            const previewImage = compressed[0] ?? imagesToAnalyse[0].dataUrl;

            clearInterval(stepInterval);
            setScanState('done');

            const stored =
                setSessionJSON('ecotrack_payload', identifyData.payload) &&
                setSessionJSON('ecotrack_guide', guideData.guide ?? {}) &&
                setSessionJSON('ecotrack_dpp', dppData.dpp) &&
                setSessionValue('ecotrack_image', previewImage);

            if (!stored) {
                throw new Error('Could not store scan results in browser session. Please try again.');
            }

            // Save to Firestore — tag with org/worker context when available
            const scanCtx: ScanContext = {
                orgId:      profile?.orgId       ?? undefined,
                workerId:   user?.uid             ?? undefined,
                workerName: user?.displayName ?? profile?.displayName ?? undefined,
            };

            const [scanId] = await Promise.all([
                saveScan(identifyData.payload, previewImage, 'single', guideData.guide ?? {}, dppData.dpp, 'web', undefined, scanCtx).catch(async (err: unknown) => {
                    console.error('[EcoTrack] Firestore save failed:', (err as Error)?.message ?? err);
                    // If offline, queue for later upload
                    if (!navigator.onLine) {
                        enqueueOfflineScan(
                            identifyData.payload!, previewImage, 'single',
                            guideData.guide ?? {}, dppData.dpp, 'web', undefined, scanCtx
                        );
                        setOfflineQueued(true);
                        setPendingOffline(getOfflineQueueSize());
                    }
                    return null;
                }),
                new Promise((resolve) => setTimeout(resolve, 600)),
            ]);

            router.push(scanId ? `/scan/result?scan=${scanId}` : '/scan/result');
        } catch (err) {
            clearInterval(stepInterval);
            setError(err instanceof Error ? err.message : 'Analysis failed');
            setScanState('error');
        }
    }, [profile?.displayName, profile?.orgId, router, user?.displayName, user?.uid]);

    const reset = () => {
        setScanState('idle');
        setError(null);
        setAnalysisStep(0);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0">
            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid flex items-center gap-3">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                    <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <Layers size={14} style={{ color: '#84cc16' }} />
                        <span className="page-label">{t('scan.multi_view')}</span>
                    </div>
                    <h1 className="page-title text-2xl lg:text-3xl text-white">{t('scan.identify_part')}</h1>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('scan.subtitle')}</p>
                </div>
            </div>

            <div className="px-5 lg:px-10 lg:max-w-2xl flex flex-col gap-4 mt-4">

                {/* ── Analysing overlay ───────────────────────────────────── */}
                {scanState === 'analysing' && (
                    <div className="card p-10 flex flex-col items-center gap-6">
                        {/* Concentric rings */}
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'rgba(132,204,22,0.1)' }} />
                            <div className="absolute inset-3 rounded-full border-2" style={{ borderColor: 'rgba(132,204,22,0.15)' }} />
                            <div className="absolute inset-0 rounded-full border-2 border-t-[#84cc16] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap size={20} style={{ color: '#84cc16' }} />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-heading text-sm font-600 animate-pulse" style={{ color: '#84cc16' }}>
                                {ANALYSIS_STEPS[analysisStep]}
                            </p>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                {t('common.loading')} · Llama 4 Scout VLM
                            </p>
                        </div>
                        {/* Step dots */}
                        <div className="flex gap-1.5">
                            {ANALYSIS_STEPS.map((_, i) => (
                                <div
                                    key={i}
                                    className="h-1 rounded-full transition-all duration-300"
                                    style={{
                                        width: i === analysisStep ? '24px' : '6px',
                                        background: i <= analysisStep ? '#84cc16' : 'var(--border)',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Done flash ──────────────────────────────────────────── */}
                {scanState === 'done' && (
                    <div className="card p-10 flex flex-col items-center gap-3"
                        style={{ background: 'rgba(132,204,22,0.06)', border: '1px solid rgba(132,204,22,0.3)' }}>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{ background: '#84cc16' }}>
                            <Zap size={22} style={{ color: 'var(--bg-primary)' }} />
                        </div>
                        <p className="font-heading text-sm font-600" style={{ color: '#84cc16' }}>{t('scan.golden_thread')}</p>
                    </div>
                )}

                {/* ── Part Not Recognised ─────────────────────────────── */}
                {scanState === 'no_match' && (
                    <div className="flex flex-col items-center text-center py-8 px-4 gap-5">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
                            🔍
                        </div>
                        <div>
                            <p className="text-base font-bold text-white mb-1">{t('scan.part_not_rec')}</p>
                            <p className="text-sm text-secondary leading-relaxed">
                                {t('scan.part_not_rec_desc')}
                            </p>
                        </div>
                        <div className="w-full rounded-xl p-4 text-left flex flex-col gap-2"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">{t('scan.tips_for_better_scan')}</p>
                            {[
                                t('scan.tip_get_close'),
                                t('scan.tip_good_lighting'),
                                t('scan.tip_actual_component'),
                                t('scan.tip_multiple_angles'),
                            ].map((tip, i) => (
                                <p key={i} className="text-xs text-muted">{tip}</p>
                            ))}
                        </div>
                        <button
                            onClick={() => setScanState('idle')}
                            className="btn-primary w-full"
                        >
                            {t('scan.try_again')}
                        </button>
                    </div>
                )}

                {/* ── Main idle UI ────────────────────────────────────────── */}
                {(scanState === 'idle' || scanState === 'error') && (

                    <>
                        {/* Photo Slot Grid */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="page-label">{t('scan.photo_angles')}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: 'rgba(132,204,22,0.1)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.2)' }}>
                                    {filledAngles.length} / 3
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {angles.map((angle, i) => (
                                    <div key={i} className="relative aspect-square">
                                        {angle ? (
                                            /* Filled slot */
                                            <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-green-500/50">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={angle.dataUrl}
                                                    alt={angle.label}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                                                    style={{ background: 'rgba(13,15,20,0.75)' }}>
                                                    <p className="text-white text-[9px] font-medium truncate">{angle.label}</p>
                                                </div>
                                                <button
                                                    onClick={() => removeAngle(i)}
                                                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                                                    style={{ background: 'rgba(239,68,68,0.85)' }}
                                                >
                                                    <X size={10} className="text-white" />
                                                </button>
                                            </div>
                                        ) : (
                                            /* Empty slot */
                                            <div
                                                className="w-full h-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5"
                                                style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
                                            >
                                                <p className="text-[9px] font-medium px-1 text-center" style={{ color: 'var(--text-muted)' }}>
                                                    {ANGLE_LABELS[i]}
                                                </p>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openCamera(i)}
                                                        title={t('scan.use_camera')}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                                                        style={{ background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.3)' }}
                                                    >
                                                        <Camera size={13} style={{ color: '#84cc16' }} />
                                                    </button>
                                                    <button
                                                        onClick={() => openPickerForSlot(i)}
                                                        title={t('scan.upload_image')}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                                                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                                                    >
                                                        <Upload size={12} style={{ color: 'var(--text-muted)' }} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Tip */}
                            <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                                More angles = higher confidence. Minimum 1 required.
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 rounded-xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
                                <p className="text-xs text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Analyse button */}
                        {filledAngles.length > 0 && (
                            <button onClick={() => runAnalysis(filledAngles)} className="btn-primary">
                                <Layers size={16} />
                                Analyse {filledAngles.length} Angle{filledAngles.length > 1 ? 's' : ''} with AI
                            </button>
                        )}

                        {/* Golden thread info */}
                        <div className="card p-4">
                            <p className="page-label mb-3">Golden Thread Flow</p>
                            <div className="flex flex-col gap-2">
                                {[
                                    '📷 Capture 1–3 angle photos',
                                    '🤖 Parallel Llama/Gemini VLM per angle',
                                    '🔀 Merge results → highest confidence',
                                    '🔒 Safety Gatekeeper rule engine',
                                    '📚 RAG disassembly guide retrieval',
                                    '📄 Digital Product Passport generation',
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-2.5">
                                        <span
                                            className="w-5 h-5 rounded-full text-[9px] flex items-center justify-center shrink-0 font-bold"
                                            style={{ background: 'rgba(132,204,22,0.1)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.2)' }}
                                        >
                                            {i + 1}
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Hidden file input */}
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* ── Camera viewfinder modal — true fullscreen ─────────────────── */}
            {cameraOpen && (
                <div className="fixed inset-0 z-[200]" style={{ background: '#000' }}>
                    {/* Video fills entire screen */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                    />

                    {/* Scan crosshair overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 relative">
                            {[['top-0 left-0', 'border-t-2 border-l-2'], ['top-0 right-0', 'border-t-2 border-r-2'], ['bottom-0 left-0', 'border-b-2 border-l-2'], ['bottom-0 right-0', 'border-b-2 border-r-2']].map(([pos, brd], i) => (
                                <div key={i} className={`absolute w-8 h-8 ${pos} ${brd} border-green-400 rounded-sm`} />
                            ))}
                        </div>
                    </div>

                    {/* Top bar — floated over video */}
                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-12 pb-6"
                        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)' }}>
                        <button
                            onClick={closeCamera}
                            className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{
                                background: 'rgba(15,23,42,0.55)',
                                border: '1px solid rgba(255,255,255,0.45)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                                backdropFilter: 'blur(6px)',
                            }}
                        >
                            <X size={18} style={{ color: '#F8FAFC' }} />
                        </button>
                        <p className="text-white text-sm font-semibold drop-shadow">{ANGLE_LABELS[activeSlotRef.current]}</p>
                        <button
                            onClick={flipCamera}
                            className="h-9 px-3 rounded-full flex items-center justify-center gap-1.5"
                            style={{
                                background: 'rgba(15,23,42,0.55)',
                                border: '1px solid rgba(255,255,255,0.45)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                                backdropFilter: 'blur(6px)',
                            }}
                        >
                            <SwitchCamera size={16} style={{ color: '#F8FAFC' }} />
                            <span className="text-[11px] font-semibold" style={{ color: '#F8FAFC' }}>Use Other Camera</span>
                        </button>
                    </div>

                    {/* Shutter — floated at bottom over video */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-12 pt-6"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}>
                        <button
                            onClick={capturePhoto}
                            className="rounded-full flex items-center justify-center active:scale-90 transition-transform"
                            style={{ width: 72, height: 72, background: '#fff', boxShadow: '0 0 0 5px rgba(255,255,255,0.3)' }}
                        >
                            <div className="w-14 h-14 rounded-full" style={{ background: '#84cc16' }} />
                        </button>
                    </div>
                </div>
            )}


            <BottomNav />
        </div>
    );
}
