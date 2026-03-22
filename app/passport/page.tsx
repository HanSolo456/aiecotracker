'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Download, Printer, FileText, Recycle, TrendingUp, Calendar, User, AlertTriangle, Coins, CheckCircle, QrCode, Share2, Copy } from 'lucide-react';
import QRCodeSVG from 'react-qr-code';
import BottomNav from '@/components/BottomNav';
import { getScanById, getScanByPassportId, restoreScanToSession } from '@/lib/scanService';
import { buildDppShareUrl } from '@/lib/dppLink';
import type { DigitalProductPassport, BillOfMaterialsEntry } from '@/types';
import { getSessionJSON } from '@/lib/sessionState';

const gradeStyle: Record<string, { text: string; bg: string; border: string; score: number }> = {
    A: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', score: 1.0 },
    B: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', score: 0.6 },
    C: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', score: 0.2 },
    UNKNOWN: { text: 'text-secondary', bg: 'bg-slate-500/10', border: 'border-slate-400/30', score: 0 },
};

function GradeChip({ grade }: { grade: string }) {
    const s = gradeStyle[grade] ?? gradeStyle.UNKNOWN;
    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${s.text} ${s.bg} ${s.border}`}>
            {grade}
        </span>
    );
}

function WRIDonut({ wri }: { wri: number }) {
    const pct = Math.round(wri * 100);
    const color = wri >= 0.85 ? '#22C55E' : wri >= 0.65 ? '#F59E0B' : '#EF4444';
    const r = 34;
    const circumference = 2 * Math.PI * r;
    const dashOffset = circumference * (1 - wri);
    return (
        <div className="relative w-24 h-24 mx-auto">
            <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
                <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle
                    cx="40" cy="40" r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-white">{pct}</span>
                <span className="text-xs text-secondary">WRI</span>
            </div>
        </div>
    );
}

function PassportPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromHistory = searchParams.get('from') === 'history';
    const passportIdParam = searchParams.get('id');
    const scanIdParam = searchParams.get('scan');
    const [dpp, setDpp] = useState<DigitalProductPassport | null>(null);
    const [redeemed, setRedeemed] = useState(false);
    const [redeeming, setRedeeming] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [copiedShareLink, setCopiedShareLink] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (passportIdParam) {
                try {
                    const record = await getScanByPassportId(passportIdParam);
                    if (!record?.dpp) {
                        if (!cancelled) setLoadError('Passport not found.');
                        return;
                    }
                    setDpp(JSON.parse(record.dpp));
                } catch {
                    if (!cancelled) setLoadError('Failed to load passport.');
                }
                return;
            }

            let d = getSessionJSON<DigitalProductPassport>('ecotrack_dpp');
            if (!d && scanIdParam) {
                try {
                    const scan = await getScanById(scanIdParam);
                    if (scan?.dpp) {
                        restoreScanToSession(scan);
                        d = getSessionJSON<DigitalProductPassport>('ecotrack_dpp');
                    }
                } catch {
                    if (!cancelled) setLoadError('Failed to load passport.');
                    return;
                }
            }

            if (!d) {
                router.replace('/scan');
                return;
            }

            if (!cancelled) setDpp(d);
        }

        void load();
        return () => { cancelled = true; };
    }, [router, passportIdParam, scanIdParam]);

    if (loadError) return (
        <div className="flex flex-col min-h-screen items-center justify-center gap-4 px-8 text-center">
            <p className="text-white font-semibold">{loadError}</p>
            <button onClick={() => router.push('/scan')} className="btn-primary mt-2">Back to Scan</button>
        </div>
    );

    if (!dpp) return null;

    // Guard: old scan records restored from Firestore may have an empty {} DPP.
    // If passport_metadata is missing, the DPP is unusable — redirect back to scan.
    if (!dpp.passport_metadata) {
        return (
            <div className="flex flex-col min-h-screen items-center justify-center gap-4 px-8 text-center">
                <p className="text-white font-semibold">No Passport Data</p>
                <p className="text-sm text-secondary">This scan was recorded before passport storage was enabled. Scan the part again to generate a full Digital Product Passport.</p>
                <button
                    onClick={() => router.push('/history')}
                    className="btn-primary mt-2"
                >
                    Back to History
                </button>
            </div>
        );
    }

    const { passport_metadata, component_identity, material_composition, disassembly_passport, end_of_life_routing, audit_trail } = dpp;
    const shareUrl = buildDppShareUrl(passport_metadata.passport_id);

    const downloadDPP = () => {
        const blob = new Blob([JSON.stringify(dpp, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${passport_metadata.passport_id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const printDPP = () => window.print();

    const downloadQR = () => {
        const svg = qrRef.current?.querySelector('svg');
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size;
        canvas.height = size + 80; // extra space for label
        const ctx = canvas.getContext('2d')!;
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
            // Draw QR centred with 24px padding
            ctx.drawImage(img, 24, 24, size - 48, size - 48);
            // Label below
            ctx.fillStyle = '#111111';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('AI-EcoTrack DPP', size / 2, size + 22);
            ctx.font = '11px monospace';
            ctx.fillStyle = '#555555';
            ctx.fillText(passport_metadata.passport_id.slice(0, 32), size / 2, size + 44);
            const host = (() => {
                try {
                    return new URL(shareUrl).host;
                } catch {
                    return 'aiecotracker.vercel.app';
                }
            })();
            ctx.fillText(host, size / 2, size + 62);
            const a = document.createElement('a');
            a.download = `QR_${passport_metadata.passport_id}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
    };

    const redeemCredits = () => {
        setRedeeming(true);
        setTimeout(() => { setRedeeming(false); setRedeemed(true); }, 1500);
    };

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedShareLink(true);
            window.setTimeout(() => setCopiedShareLink(false), 1800);
        } catch {
            setCopiedShareLink(false);
        }
    };

    const shareDppLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'AI-EcoTrack Digital Product Passport',
                    text: `Digital Product Passport: ${passport_metadata.passport_id}`,
                    url: shareUrl,
                });
                return;
            } catch {
                // fall through to clipboard copy
            }
        }
        await copyShareLink();
    };

    return (
        <div className="flex flex-col min-h-screen pb-28">
            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-4 flex items-center gap-3">
                <button
                    onClick={() => {
                        if (fromHistory) {
                            router.push('/history');
                            return;
                        }
                        router.push(scanIdParam ? `/guide?scan=${scanIdParam}` : '/guide');
                    }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                    <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="flex-1">
                    <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Digital Product Passport</h1>
                    <p className="text-xs text-secondary font-mono">{passport_metadata.passport_id}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={printDPP}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        title="Print / Save PDF"
                    >
                        <Printer size={15} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <button
                        onClick={downloadDPP}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        title="Download JSON"
                    >
                        <Download size={15} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>
            </div>

            <div className="px-5 flex flex-col gap-4">
                {/* ── Credits Earned Hero Card ─────────────────────── */}
                <div
                    className="rounded-2xl p-5 border"
                    style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.06) 100%)',
                        borderColor: 'rgba(34,197,94,0.3)',
                    }}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Coins size={14} className="text-green-400" />
                                <p className="text-xs font-semibold uppercase tracking-wide text-green-400">Credits Earned</p>
                            </div>
                            <p className="text-3xl font-bold text-white mt-1">
                                ₹{material_composition.total_theoretical_recovery_value_usd.toFixed(2)}
                                <span className="text-base font-normal text-green-400 ml-1">INR</span>
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                Based on AI-verified material purity · {material_composition.total_mass_kg} kg
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>WRI Score</p>
                            <p className="text-xl font-bold text-green-400">
                                {Math.round(material_composition.weighted_recyclability_index * 100)}%
                            </p>
                        </div>
                    </div>

                    {/* Redeem button */}
                    <button
                        onClick={redeemCredits}
                        disabled={redeemed || redeeming}
                        className="mt-4 w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 active:scale-95"
                        style={{
                            background: redeemed ? 'rgba(34,197,94,0.15)' : '#22C55E',
                            color: redeemed ? '#22C55E' : '#0D0F14',
                            border: redeemed ? '1px solid rgba(34,197,94,0.4)' : 'none',
                        }}
                    >
                        {redeemed ? (
                            <><CheckCircle size={16} /> Credits Redeemed ✓</>
                        ) : redeeming ? (
                            <><div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /> Processing…</>
                        ) : (
                            <><Coins size={16} /> Redeem ₹{material_composition.total_theoretical_recovery_value_usd.toFixed(2)} Credits</>
                        )}
                    </button>
                </div>

                {/* Status chip */}
                <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-brand-green/10 border border-brand-green/30 text-brand-green font-medium capitalize">
                        {passport_metadata.lifecycle_stage.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted">EU ESPR 2024 · {passport_metadata.regulatory_frameworks.length} frameworks</span>
                </div>

                {/* Component Identity */}
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText size={13} className="text-secondary" />
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Component Identity</p>
                    </div>
                    <p className="text-sm font-bold text-white capitalize">{component_identity.description}</p>
                    {component_identity.manufacturer_part_number && (
                        <p className="text-xs text-secondary font-mono mt-1">{component_identity.manufacturer_part_number}</p>
                    )}
                    <p className="text-xs text-muted mt-1 font-mono">{component_identity.ecotrack_uid}</p>
                </div>

                {/* WRI / Recovery Summary */}
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={13} className="text-brand-green" />
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Recovery Summary</p>
                    </div>
                    <div className="flex items-center gap-5">
                        <WRIDonut wri={material_composition.weighted_recyclability_index} />
                        <div className="flex flex-col gap-3 flex-1">
                            <div>
                                <p className="text-xs text-secondary">Total Mass</p>
                                <p className="text-base font-bold text-white">{material_composition.total_mass_kg} kg</p>
                            </div>
                            <div>
                                <p className="text-xs text-secondary">Recovery Value</p>
                                <p className="text-base font-bold text-amber-400">₹{material_composition.total_theoretical_recovery_value_usd.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bill of Materials */}
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Recycle size={13} className="text-secondary" />
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Bill of Materials</p>
                    </div>
                    <div className="flex flex-col gap-0">
                        {material_composition.bill_of_materials.map((entry: BillOfMaterialsEntry, i: number) => (
                            <div
                                key={i}
                                className={`flex items-center gap-3 py-2.5 ${i < material_composition.bill_of_materials.length - 1 ? 'border-b' : ''}`}
                                style={i < material_composition.bill_of_materials.length - 1 ? { borderColor: 'var(--border)' } : {}}
                            >
                                <GradeChip grade={entry.recyclability_class} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{entry.material_designation}</p>
                                    <p className="text-xs text-muted">{entry.mass_kg} kg · {entry.mass_fraction_pct}%</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold text-amber-400">₹{(entry.mass_kg * entry.recovery_value_usd_per_kg).toFixed(2)}</p>
                                    <p className="text-xs text-muted">₹{entry.recovery_value_usd_per_kg}/kg</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Material Stream Visual ─────────────────────────────── */}
                {(() => {
                    const bom = material_composition.bill_of_materials;
                    const totalMass = material_composition.total_mass_kg || 1;

                    // Bucket entries by stream
                    const streams = {
                        reuse: bom.filter(e => e.recyclability_class === 'A'),
                        recycle: bom.filter(e => e.recyclability_class === 'B' && !e.hazardous_substance_content),
                        hazardous: bom.filter(e => e.recyclability_class === 'C' || e.hazardous_substance_content),
                    };

                    const sumMass = (arr: BillOfMaterialsEntry[]) => arr.reduce((s, e) => s + e.mass_kg, 0);
                    const sumValue = (arr: BillOfMaterialsEntry[]) => arr.reduce((s, e) => s + e.mass_kg * e.recovery_value_usd_per_kg, 0);

                    const reuseMass = sumMass(streams.reuse);
                    const recycleMass = sumMass(streams.recycle);
                    const hazardMass = sumMass(streams.hazardous);

                    const reuseVal = sumValue(streams.reuse);
                    const recycleVal = sumValue(streams.recycle);
                    const hazardVal = sumValue(streams.hazardous);

                    const reusePct = Math.round((reuseMass / totalMass) * 100);
                    const recyclePct = Math.round((recycleMass / totalMass) * 100);
                    const hazardPct = Math.max(0, 100 - reusePct - recyclePct);

                    const streamDefs = [
                        {
                            key: 'reuse',
                            label: 'Ready for Reuse',
                            emoji: '♻️',
                            color: '#22c55e',
                            bg: 'rgba(34,197,94,0.10)',
                            border: 'rgba(34,197,94,0.25)',
                            pct: reusePct,
                            mass: reuseMass,
                            value: reuseVal,
                            entries: streams.reuse,
                            desc: 'Grade A — direct reuse or refurbishment',
                        },
                        {
                            key: 'recycle',
                            label: 'Recyclable',
                            emoji: '🔵',
                            color: '#60a5fa',
                            bg: 'rgba(96,165,250,0.10)',
                            border: 'rgba(96,165,250,0.25)',
                            pct: recyclePct,
                            mass: recycleMass,
                            value: recycleVal,
                            entries: streams.recycle,
                            desc: 'Grade B — secondary material recovery',
                        },
                        {
                            key: 'hazardous',
                            label: 'Hazardous Waste',
                            emoji: '⚠️',
                            color: '#f87171',
                            bg: 'rgba(248,113,113,0.10)',
                            border: 'rgba(248,113,113,0.25)',
                            pct: hazardPct,
                            mass: hazardMass,
                            value: hazardVal,
                            entries: streams.hazardous,
                            desc: 'Grade C — licensed disposal required',
                        },
                    ];

                    return (
                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Recycle size={13} className="text-brand-green" />
                                <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Material Stream Mapping</p>
                            </div>

                            {/* Segmented bar */}
                            <div className="flex rounded-full overflow-hidden h-3 mb-1 gap-0.5">
                                {streamDefs.map(s => s.pct > 0 && (
                                    <div
                                        key={s.key}
                                        style={{ width: `${s.pct}%`, background: s.color, opacity: 0.85 }}
                                        className="transition-all duration-500"
                                    />
                                ))}
                            </div>
                            {/* Bar legend */}
                            <div className="flex items-center gap-4 mb-5 mt-2">
                                {streamDefs.map(s => s.pct > 0 && (
                                    <div key={s.key} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                                        <span className="text-[10px] text-muted">{s.label} {s.pct}%</span>
                                    </div>
                                ))}
                            </div>

                            {/* Stream cards */}
                            <div className="flex flex-col gap-3">
                                {streamDefs.map(s => (
                                    <div
                                        key={s.key}
                                        className="rounded-xl p-3"
                                        style={{ background: s.bg, border: `1px solid ${s.border}` }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{s.emoji}</span>
                                                <div>
                                                    <p className="text-xs font-bold text-white">{s.label}</p>
                                                    <p className="text-[10px]" style={{ color: s.color }}>{s.desc}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-white">{s.mass.toFixed(2)} kg</p>
                                                <p className="text-[10px] text-amber-400 font-semibold">₹{s.value.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        {s.entries.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: `1px solid ${s.border}` }}>
                                                {s.entries.map((e, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                                                        style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}
                                                    >
                                                        {e.material_designation} ({e.mass_fraction_pct}%)
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-muted mt-1 pt-2" style={{ borderTop: `1px solid ${s.border}` }}>No materials in this stream</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* ── Regulatory Compliance ───────────────────────────── */}
                {dpp.regulatory_compliance && (() => {
                    const rc = dpp.regulatory_compliance!;
                    const statusColor = (s: string) => {
                        if (s.includes('COMPLIANT') && !s.includes('NON') && !s.includes('CONDITIONAL')) return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' };
                        if (s.includes('CONDITIONAL') || s.includes('MONITOR')) return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' };
                        if (s.includes('NON') || s.includes('RESTRICTED') || s.includes('PROHIBITED')) return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' };
                        return { bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)', text: '#9ca3af' };
                    };
                    const frameworks = [
                        { label: 'RoHS 3', sub: 'EU 2015/863', status: rc.RoHS3.status, notes: rc.RoHS3.notes },
                        { label: 'REACH SVHC', sub: `${rc.REACH.svhc_count} substance(s) flagged`, status: rc.REACH.status, notes: rc.REACH.notes },
                        { label: 'WEEE', sub: rc.WEEE.applicable ? 'EEE — collection required' : 'Not EEE', status: rc.WEEE.applicable ? 'APPLICABLE' : 'NOT_APPLICABLE', notes: rc.WEEE.notes ?? '' },
                        { label: 'EU ESPR 2024', sub: `DPP class ${rc.EU_ESPR.recyclability_class}`, status: 'COMPLIANT', notes: rc.EU_ESPR.end_of_life_route },
                        { label: 'BIS India', sub: rc.BIS_India.e_waste_applicable ? 'E-Waste EPR applies' : 'No EPR obligation', status: rc.BIS_India.e_waste_applicable ? 'MONITOR' : 'COMPLIANT', notes: rc.BIS_India.relevant_standards.join(' · ') || '—' },
                    ];
                    return (
                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle size={13} className="text-brand-green" />
                                <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Regulatory Compliance</p>
                                <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                                    {rc.display_name}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2">
                                {frameworks.map(fw => {
                                    const col = statusColor(fw.status);
                                    return (
                                        <div key={fw.label} className="rounded-xl p-3" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-white">{fw.label}</p>
                                                    <p className="text-[10px] text-secondary mt-0.5">{fw.sub}</p>
                                                </div>
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                                                    {fw.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            {fw.notes && (
                                                <p className="text-[10px] text-secondary mt-1.5 leading-relaxed">{fw.notes}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Hazard warning */}
                            {rc.is_hazardous && (
                                <div className="mt-3 rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                    <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-red-400">Hazardous Material</p>
                                        <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">{rc.hazard_note}</p>
                                        {rc.special_disposal_required && (
                                            <p className="text-[10px] font-semibold text-red-400 mt-1">⚠ Licensed disposal facility required</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Export control */}
                            {rc.BIS_India.export_control && (
                                <div className="mt-2 rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-secondary leading-relaxed"><span className="font-bold text-amber-400">SCOMET/Export Control: </span>{rc.BIS_India.export_control}</p>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── QR Code ────────────────────────────────────────── */}

                <div
                    className="p-4 sm:p-5 rounded-3xl"
                    style={{
                        background: 'linear-gradient(165deg, rgba(17,24,39,0.94) 0%, rgba(7,19,46,0.9) 55%, rgba(8,31,49,0.92) 100%)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 36px rgba(2,6,23,0.35)',
                    }}
                >
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2.5">
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(132,204,22,0.16)', border: '1px solid rgba(132,204,22,0.35)' }}
                            >
                                <QrCode size={14} className="text-brand-green" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Digital Identity</p>
                                <p className="text-sm font-semibold text-white">Public DPP QR</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={shareDppLink}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all active:scale-95"
                                style={{
                                    borderColor: 'rgba(96,165,250,0.5)',
                                    color: '#7DB5FF',
                                    background: 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(96,165,250,0.06) 100%)',
                                }}
                            >
                                <Share2 size={11} /> Share
                            </button>
                            <button
                                onClick={downloadQR}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all active:scale-95"
                                style={{
                                    borderColor: 'rgba(34,197,94,0.5)',
                                    color: '#34D399',
                                    background: 'linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(34,197,94,0.06) 100%)',
                                }}
                            >
                                <Download size={11} /> Save
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        {/* QR Code — white surface for maximum scanner reliability */}
                        <div
                            ref={qrRef}
                            className="rounded-[28px] p-5 shadow-2xl"
                            style={{
                                background: '#ffffff',
                                border: '1px solid rgba(2,6,23,0.08)',
                                boxShadow: '0 20px 40px rgba(2,6,23,0.35)',
                            }}
                        >
                            <QRCodeSVG
                                value={shareUrl}
                                size={190}
                                bgColor="#ffffff"
                                fgColor="#0B1220"
                                level="H"
                                style={{ display: 'block' }}
                            />
                        </div>

                        <div className="text-center">
                            <p className="text-base font-semibold text-white">Scan to open full DPP timeline</p>
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{passport_metadata.passport_id}</p>
                        </div>

                        <div
                            className="w-full rounded-2xl p-2.5 flex items-center gap-2"
                            style={{
                                background: 'rgba(15,23,42,0.58)',
                                border: '1px solid rgba(148,163,184,0.2)',
                                backdropFilter: 'blur(6px)',
                            }}
                        >
                            <p className="text-[11px] font-mono break-all flex-1 leading-relaxed px-1" style={{ color: 'rgba(203,213,225,0.95)' }}>
                                {shareUrl}
                            </p>
                            <button
                                onClick={copyShareLink}
                                className="shrink-0 flex items-center gap-1 text-[11px] font-semibold px-3 py-2 rounded-xl transition-all"
                                style={{
                                    background: copiedShareLink ? 'rgba(34,197,94,0.22)' : 'rgba(30,41,59,0.9)',
                                    color: copiedShareLink ? '#22C55E' : '#CBD5E1',
                                    border: copiedShareLink ? '1px solid rgba(34,197,94,0.45)' : '1px solid rgba(148,163,184,0.25)',
                                }}
                            >
                                <Copy size={11} /> {copiedShareLink ? 'Copied' : 'Copy'}
                            </button>
                        </div>

                        <div
                            className="w-full rounded-2xl px-3 py-3 grid grid-cols-3 gap-2"
                            style={{ background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.2)' }}
                        >
                            <div className="text-center">
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Standard</p>
                                <p className="text-sm font-semibold text-white mt-0.5">EU ESPR 2024</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Correction</p>
                                <p className="text-sm font-semibold text-white mt-0.5">Level H</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Format</p>
                                <p className="text-sm font-semibold text-white mt-0.5">QR v3</p>
                            </div>
                        </div>

                        <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Print and attach this code to the physical part.
                            <br />
                            Scanning opens the verified Digital Product Passport record.
                        </p>
                    </div>
                </div>

                {/* EoL Routing */}
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Recycle size={13} className="text-brand-green" />
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">End-of-Life Routing</p>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-brand-green/10 border border-brand-green/30 text-brand-green font-semibold capitalize">
                            {end_of_life_routing.routing_decision.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">{end_of_life_routing.routing_rationale}</p>
                </div>

                {/* VLM Scan Event */}
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={13} className="text-secondary" />
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">VLM Scan Event</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-secondary">Part Confidence</p>
                            <p className="text-sm font-bold text-white">{Math.round(disassembly_passport.vlm_identification_event.part_confidence_score * 100)}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-secondary">Material Confidence</p>
                            <p className="text-sm font-bold text-white">{Math.round(disassembly_passport.vlm_identification_event.material_confidence_score * 100)}%</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs text-secondary">Model</p>
                            <p className="text-xs font-mono text-white mt-0.5">{disassembly_passport.vlm_identification_event.vlm_model_version}</p>
                        </div>
                    </div>
                </div>

                {/* Audit Trail */}
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar size={13} className="text-secondary" />
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Audit Trail</p>
                    </div>
                    <div className="relative flex flex-col gap-0">
                        {audit_trail.map((event, i) => (
                            <div key={i} className="flex items-start gap-3 pb-3 last:pb-0">
                                {/* Timeline dot & line */}
                                <div className="flex flex-col items-center shrink-0 pt-0.5">
                                    <div className="w-2 h-2 rounded-full bg-brand-green shrink-0" />
                                    {i < audit_trail.length - 1 && <div className="w-px flex-1 mt-1 min-h-[16px]" style={{ background: 'var(--border)' }} />}
                                </div>
                                <div className="pb-1">
                                    <p className="text-xs font-medium text-white capitalize">{event.event.replace(/_/g, ' ')}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <User size={9} className="text-muted" />
                                        <p className="text-xs text-muted">{event.actor}</p>
                                    </div>
                                    <p className="text-xs text-muted font-mono">{new Date(event.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Download DPP JSON */}
                <button onClick={downloadDPP} className="btn-secondary mb-4">
                    <Download size={16} />
                    Export DPP as JSON (EU ESPR Format)
                </button>
            </div>

            <BottomNav />
        </div>
    );
}
export default function PassportPage() {
    return (
        <Suspense fallback={null}>
            <PassportPageInner />
        </Suspense>
    );
}
