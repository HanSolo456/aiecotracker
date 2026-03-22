'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Shield, Wrench, Clock, AlertTriangle, BookOpen, ExternalLink, Droplets, CheckCircle2, Volume2, VolumeX, Loader2, Square } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ContextualAssistant from '@/components/ContextualAssistant';
import { useLanguage } from '@/components/LanguageProvider';
import { buildGuideSSML, fetchTtsAudio, stopTts, type TtsStatus } from '@/lib/ttsService';
import type { GuideResult, PartMetadataPayload } from '@/types';
import { getSessionJSON } from '@/lib/sessionState';
import { getScanById, restoreScanToSession } from '@/lib/scanService';

function GuidePageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromHistory = searchParams.get('from') === 'history';
    const scanId = searchParams.get('scan');
    const { t, lang } = useLanguage();
    const [guide, setGuide] = useState<GuideResult | null>(null);
    const [payload, setPayload] = useState<PartMetadataPayload | null>(null);
    const [expanded, setExpanded] = useState<number | null>(0);
    const [showCitations, setShowCitations] = useState(false);
    const [fluidRisk, setFluidRisk] = useState<string>('none');
    const [fluidConfirmed, setFluidConfirmed] = useState(false);
    const [ttsStatus, setTtsStatus] = useState<TtsStatus>('idle');
    const [ttsError, setTtsError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            let g = getSessionJSON<GuideResult>('ecotrack_guide');
            let p = getSessionJSON<PartMetadataPayload>('ecotrack_payload');

            if (!g && scanId) {
                try {
                    const scan = await getScanById(scanId);
                    if (scan?.fullPayload) {
                        restoreScanToSession(scan);
                        g = getSessionJSON<GuideResult>('ecotrack_guide');
                        p = getSessionJSON<PartMetadataPayload>('ecotrack_payload');
                    }
                } catch {
                    if (!cancelled) setLoadError('Failed to load guide data.');
                    return;
                }
            }

            if (!g) {
                router.replace('/scan');
                return;
            }

            if (!cancelled) {
                setGuide(g);
                if (p) {
                    setPayload(p);
                    const risk = p.hazard_flags?.residual_fluid_risk ?? 'none';
                    setFluidRisk(risk);
                    if (risk === 'none') setFluidConfirmed(true);
                } else {
                    setFluidConfirmed(true);
                }
            }
        }

        void load();
        return () => {
            stopTts();
            cancelled = true;
        };
    }, [router, scanId]);

    if (loadError) {
        return (
            <div className="flex flex-col min-h-screen items-center justify-center gap-4 px-8 text-center">
                <p className="text-white font-semibold">{loadError}</p>
                <button onClick={() => router.push('/scan')} className="btn-primary mt-2">Back to Scan</button>
            </div>
        );
    }

    const handleListen = async () => {
        if (!guide) return;

        // If paused → resume
        if (ttsStatus === 'paused' && audioRef.current) {
            audioRef.current.play();
            setTtsStatus('playing');
            return;
        }

        // If playing → pause
        if (ttsStatus === 'playing' && audioRef.current) {
            audioRef.current.pause();
            setTtsStatus('paused');
            return;
        }

        // Start fresh
        setTtsStatus('loading');
        setTtsError(null);
        try {
            // Build SSML — pass hazard info if present so it's read loudly
            const FLUID_INSTRUCTIONS_TITLES: Record<string, string> = {
                hydrocarbon_likely: 'Hydrocarbon or oil residue detected',
                chemical_likely:    'Chemical residue detected. High risk.',
                coolant_likely:     'Coolant residue detected',
            };
            const hazardTitle = FLUID_INSTRUCTIONS_TITLES[fluidRisk];

            // Get the fluid steps for SSML (English, always)
            const FLUID_STEPS: Record<string, string[]> = {
                hydrocarbon_likely: [
                    'Don chemical-resistant gloves and eye protection',
                    'Drain any residual fluid into a certified waste-oil container',
                    'Flush interior surfaces with industrial degreaser',
                    'Dispose of flush fluid per NFPA 30 regulations',
                    'Ensure zero residue before proceeding',
                ],
                chemical_likely: [
                    'STOP — do not proceed without full SDS review',
                    'Don full PPE: respirator, face shield, chemical-resistant suit',
                    'Neutralise with appropriate agent per SDS instructions',
                    'Notify your site safety officer before any hands-on work',
                ],
                coolant_likely: [
                    'Don chemical-resistant gloves',
                    'Drain coolant into a sealed container for recycling',
                    'Flush with clean water and collect rinse fluid for disposal',
                ],
            };
            const hazardSteps = FLUID_STEPS[fluidRisk];

            // Guide content is always in English (AI-generated)
            const ttsLang = lang === 'hi' ? 'hi-IN' : 'en-US';
            const ssml = buildGuideSSML(guide, hazardTitle, hazardSteps, lang);
            const audio = await fetchTtsAudio(ssml, ttsLang);
            audioRef.current = audio;

            audio.addEventListener('ended', () => setTtsStatus('idle'), { once: true });
            audio.play();
            setTtsStatus('playing');
        } catch (err) {
            console.error('[Guide TTS]', err);
            setTtsError('Could not load audio. Check your API key or connection.');
            setTtsStatus('error');
        }
    };

    const handleStop = () => {
        stopTts();
        audioRef.current = null;
        setTtsStatus('idle');
    };

    if (!guide) return null;

    // Normalise: old scans restored from Firestore may have an empty {} guide.
    const safeGuide = {
        ...guide,
        disassembly_steps: guide.disassembly_steps ?? [],
        safety_protocols: guide.safety_protocols ?? [],
        source_citations: guide.source_citations ?? [],
        special_tooling_required: guide.special_tooling_required ?? [],
        environmental_notes: guide.environmental_notes ?? [],
        estimated_total_time_min: guide.estimated_total_time_min ?? null,
    };

    const hasSafetyProtocols = safeGuide.safety_protocols.length > 0;

    // Per-fluid disposal instructions (content stays in English — AI-generated safety info)
    const FLUID_INSTRUCTIONS: Record<string, { title: string; color: string; bg: string; border: string; steps: string[] }> = {
        hydrocarbon_likely: {
            title: '⚠ Hydrocarbon / Oil Residue Detected',
            color: '#F59E0B',
            bg: 'rgba(245,158,11,0.08)',
            border: 'rgba(245,158,11,0.35)',
            steps: [
                'Don chemical-resistant gloves and eye protection (PPE Level B)',
                'Drain any residual fluid into a certified waste-oil container',
                'Flush interior surfaces with industrial degreaser (e.g. Castrol Alusol)',
                'Dispose of flush fluid per NFPA 30 flammable liquid regulations',
                'Ensure zero residue before proceeding to disassembly',
            ],
        },
        chemical_likely: {
            title: '🔴 Chemical Residue Detected — HIGH RISK',
            color: '#EF4444',
            bg: 'rgba(239,68,68,0.08)',
            border: 'rgba(239,68,68,0.35)',
            steps: [
                'STOP — do not proceed without full SDS review for likely chemicals',
                'Don full PPE: respirator, face shield, chemical-resistant suit',
                'Neutralise with appropriate agent per SDS instructions',
                'Notify your site safety officer before any hands-on work',
                'Document incident in OSHA 300 log if residue exceeds threshold',
            ],
        },
        coolant_likely: {
            title: '⚠ Coolant Residue Detected',
            color: '#60A5FA',
            bg: 'rgba(96,165,250,0.08)',
            border: 'rgba(96,165,250,0.35)',
            steps: [
                'Don chemical-resistant gloves — coolant may contain glycol/biocides',
                'Drain coolant into a sealed container for recycling (do NOT pour to drain)',
                'Flush with clean water, collect rinse fluid for disposal',
                'Dispose per local hazardous waste regulations (EPA 40 CFR Part 261)',
            ],
        },
    };
    const fluidInfo = FLUID_INSTRUCTIONS[fluidRisk];

    return (
        <div className="flex flex-col min-h-screen pb-28">

            {/* Hazardous Fluid Disposal Modal */}
            {fluidInfo && !fluidConfirmed && (
                <div className="fixed inset-0 z-[60] flex flex-col"
                    style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
                    <div className="w-full h-1 shrink-0" style={{ background: fluidInfo.color }} />
                    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                                style={{ background: fluidInfo.bg, border: `1.5px solid ${fluidInfo.border}` }}>
                                <Droplets size={22} style={{ color: fluidInfo.color }} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                                    style={{ color: fluidInfo.color }}>{t('guide.hazard_detected')}</p>
                                <p className="text-base font-bold text-white leading-snug">
                                    {fluidInfo.title.replace(/^[⚠🔴]\s*/, '')}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-xl px-4 py-3 mb-5"
                            style={{ background: fluidInfo.bg, border: `1px solid ${fluidInfo.border}` }}>
                            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.80)' }}>
                                {t('guide.hazard_locked')}
                            </p>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                            style={{ color: 'var(--text-muted)' }}>{t('guide.mandatory_disposal')}</p>
                        <div className="flex flex-col gap-3 mb-4">
                            {fluidInfo.steps.map((step, i) => (
                                <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <span className="w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                                        style={{ background: fluidInfo.bg, border: `1px solid ${fluidInfo.border}`, color: fluidInfo.color }}>
                                        {i + 1}
                                    </span>
                                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="shrink-0 px-5 pt-3 pb-6"
                        style={{ background: 'rgba(13,15,20,0.97)', borderTop: `1px solid ${fluidInfo.border}` }}>
                        <button
                            onClick={() => setFluidConfirmed(true)}
                            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 active:scale-95 transition-transform duration-150"
                            style={{ background: fluidInfo.color, color: '#0D0F14' }}>
                            <CheckCircle2 size={20} />
                            {t('guide.area_secured')}
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-4 flex items-center gap-3">
                <button
                    onClick={() => {
                        if (fromHistory) {
                            router.push('/history');
                            return;
                        }
                        router.push(scanId ? `/scan/result?scan=${scanId}` : '/scan/result');
                    }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                    <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('guide.title')}</h1>
                    <p className="text-xs text-secondary">
                        {t('guide.subtitle_rag')} · {safeGuide.disassembly_steps.length} {t('guide.steps')} · {safeGuide.estimated_total_time_min ?? '—'} {t('guide.min')}
                    </p>
                </div>

                {/* ── TTS Controls ── */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Stop button — only visible while playing/paused */}
                    {(ttsStatus === 'playing' || ttsStatus === 'paused') && (
                        <button
                            onClick={handleStop}
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                            title="Stop"
                        >
                            <Square size={12} style={{ color: '#EF4444' }} />
                        </button>
                    )}

                    {/* Main Listen / Pause button */}
                    <button
                        onClick={handleListen}
                        disabled={ttsStatus === 'loading'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                        style={{
                            background: ttsStatus === 'error'
                                ? 'rgba(239,68,68,0.1)'
                                : ttsStatus === 'playing' || ttsStatus === 'paused'
                                ? 'rgba(132,204,22,0.15)'
                                : 'var(--bg-elevated)',
                            border: `1px solid ${
                                ttsStatus === 'error'
                                    ? 'rgba(239,68,68,0.3)'
                                    : ttsStatus === 'playing' || ttsStatus === 'paused'
                                    ? 'rgba(132,204,22,0.35)'
                                    : 'var(--border)'
                            }`,
                            color: ttsStatus === 'error'
                                ? '#EF4444'
                                : ttsStatus === 'playing' || ttsStatus === 'paused'
                                ? '#84cc16'
                                : 'var(--text-secondary)',
                            cursor: ttsStatus === 'loading' ? 'not-allowed' : 'pointer',
                            opacity: ttsStatus === 'loading' ? 0.7 : 1,
                        }}
                        title={ttsStatus === 'playing' ? 'Pause' : ttsStatus === 'paused' ? 'Resume' : 'Listen to guide'}
                    >
                        {ttsStatus === 'loading' && <Loader2 size={13} className="animate-spin" />}
                        {ttsStatus === 'error'   && <VolumeX size={13} />}
                        {ttsStatus === 'playing' && <Volume2 size={13} style={{ animation: 'pulse 1.5s infinite' }} />}
                        {(ttsStatus === 'idle' || ttsStatus === 'paused') && <Volume2 size={13} />}
                        <span>
                            {ttsStatus === 'loading' ? 'Loading…'
                            : ttsStatus === 'playing' ? 'Pause'
                            : ttsStatus === 'paused'  ? 'Resume'
                            : ttsStatus === 'error'   ? 'Retry'
                            : '▶ Listen'}
                        </span>
                    </button>
                </div>
            </div>

            {/* TTS error hint */}
            {ttsStatus === 'error' && ttsError && (
                <div className="mx-5 mb-1 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                    {ttsError}
                </div>
            )}

            <div className="px-5 flex flex-col gap-4">
                {/* Safety Protocol Alert */}
                {hasSafetyProtocols && (
                    <div
                        className="rounded-2xl p-4"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
                    >
                        <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                                <Shield size={14} className="text-red-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1.5">{t('guide.safety_protocols')}</p>
                                <p className="text-xs text-secondary mb-2">{t('guide.safety_desc')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {safeGuide.safety_protocols.map((p) => (
                                        <span key={p} className="text-xs px-2 py-0.5 rounded-md font-mono bg-red-500/10 border border-red-500/30 text-red-300">
                                            {p.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Time estimate */}
                <div
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                    <Clock size={14} className="text-secondary" />
                    <p className="text-xs text-secondary">{t('guide.estimated_time')}&nbsp;
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{safeGuide.estimated_total_time_min ?? '—'} {t('guide.minutes')}</span>
                    </p>
                </div>

                {/* Disassembly Steps */}
                <div>
                    <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">{t('guide.procedure_steps')}</p>
                    <div className="flex flex-col gap-3">
                        {safeGuide.disassembly_steps.map((step, i) => {
                            const isOpen = expanded === i;
                            const hasSafetyRef = !!step.safety_ref;
                            return (
                                <button
                                    key={step.step}
                                    onClick={() => setExpanded(isOpen ? null : i)}
                                    className="card p-4 text-left w-full active:scale-[0.98] transition-transform duration-100"
                                    style={hasSafetyRef ? { borderColor: 'rgba(239,68,68,0.3)' } : {}}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Step number */}
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                            style={hasSafetyRef
                                                ? { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }
                                                : { background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }
                                            }
                                        >
                                            {step.step}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {/* Step preview */}
                                            <p className={`text-sm text-white leading-snug ${!isOpen ? 'line-clamp-2' : ''}`}>
                                                {step.action}
                                            </p>

                                            {/* Expanded details */}
                                            {isOpen && (
                                                <div className="mt-3 flex flex-col gap-2">
                                                    {step.tool_required && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Wrench size={11} className="text-blue-400 shrink-0" />
                                                            <span className="text-xs text-blue-300">{step.tool_required.replace(/_/g, ' ')}</span>
                                                        </div>
                                                    )}
                                                    {step.estimated_time_min && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={11} className="text-secondary shrink-0" />
                                                            <span className="text-xs text-secondary">{step.estimated_time_min} {t('guide.min')}</span>
                                                        </div>
                                                    )}
                                                    {step.safety_ref && (
                                                        <div className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                                                            <AlertTriangle size={11} className="text-red-400 shrink-0" />
                                                            <span className="text-xs text-red-300 font-medium">{step.safety_ref.replace(/_/g, ' ')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <ChevronRight
                                            size={14}
                                            className="text-muted shrink-0 transition-transform duration-200"
                                            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Source Citations */}
                <button
                    onClick={() => setShowCitations(!showCitations)}
                    className="flex items-center gap-2 text-xs text-secondary py-2"
                >
                    <ExternalLink size={12} />
                    {showCitations ? t('guide.hide_citations') : t('guide.show_citations')} ({safeGuide.source_citations.length})
                </button>

                {showCitations && (
                    <div className="card p-4">
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <BookOpen size={11} />
                            {t('guide.rag_citations')}
                        </p>
                        <div className="flex flex-col gap-3">
                            {safeGuide.source_citations.map((cite, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <span className="text-xs text-brand-green font-mono shrink-0">
                                        {Math.round(cite.relevance_score * 100)}%
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs text-white leading-snug">{cite.title}</p>
                                        <p className="text-xs text-muted mt-0.5">{cite.namespace}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <ContextualAssistant
                    payload={payload}
                    guide={safeGuide}
                    surface="guide"
                    title="Ask About This Guide"
                    description="Use this to clarify the procedure, tooling, hazards, and the reasoning behind the current guide. It answers questions only."
                />

                {/* CTA */}
                <button
                    onClick={() => {
                        const params = new URLSearchParams();
                        if (fromHistory) params.set('from', 'history');
                        if (scanId) params.set('scan', scanId);
                        const query = params.toString();
                        router.push(query ? `/passport?${query}` : '/passport');
                    }}
                    className="btn-primary mt-2"
                    style={{ background: '#84cc16', color: 'var(--bg-primary)' }}
                >
                    <BookOpen size={18} />
                    {t('guide.view_passport')}
                    <ChevronRight size={16} className="ml-auto" />
                </button>
            </div>

            <BottomNav />
        </div>
    );
}

export default function GuidePage() {
    return (
        <Suspense fallback={null}>
            <GuidePageInner />
        </Suspense>
    );
}
