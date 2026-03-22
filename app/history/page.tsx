'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Clock, FileText, ChevronDown, ChevronUp, TrendingUp, ScanLine, ShieldAlert, CheckCircle, Cpu, BookOpen, QrCode, X, Download, FileSpreadsheet, Printer } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { subscribeToRecentScans, subscribeToOrgScans, computeStats, relativeTime, restoreScanToSession, getScanRecoveryValueINR, type ScanRecord } from '@/lib/scanService';
import { exportCSV, exportPDF } from '@/lib/exportService';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/components/LanguageProvider';

let historyCache: { orgId?: string; scans: ScanRecord[] } | null = null;

const gradeStyle: Record<string, string> = {
    A: 'text-lime-400 bg-lime-500/10 border-lime-500/30',
    B: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    C: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const MATERIAL_LABELS: Record<string, string> = {
    '316L_stainless_steel': '316L Stainless Steel',
    carbon_steel: 'Carbon Steel',
    cast_iron: 'Cast Iron',
    copper_alloy: 'Copper Alloy',
    titanium: 'Titanium',
    inconel_625: 'Inconel 625',
    aluminium_alloy: 'Aluminium Alloy',
    PTFE: 'PTFE',
    unknown: 'Unknown Material',
};

const SURFACE_LABELS: Record<string, string> = {
    clean: 'Clean',
    minor_wear: 'Minor Wear',
    moderate_corrosion_grade_2: 'Moderate Corrosion',
    heavy_corrosion: 'Heavy Corrosion',
    unknown: 'Unknown',
};

function ScanCard({ item }: { item: ScanRecord }) {
    const router = useRouter();
    const { t } = useLanguage();
    const [menuOpen, setMenuOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const restore = () => restoreScanToSession(item);

    const handleCardClick = () => {
        if (!item.fullPayload) {
            // Old scan without stored data — expand details in-place
            setExpanded(e => !e);
            return;
        }
        setMenuOpen(m => !m);
    };

    const goTo = (path: string) => {
        restore();
        router.push(`${path}?from=history`);
    };

    const hasFluidRisk =
        item.hazardFlags?.residual_fluid_risk &&
        item.hazardFlags.residual_fluid_risk !== 'none' &&
        item.hazardFlags.residual_fluid_risk !== 'unknown';

    return (
        <div className="card overflow-hidden">
            {/* Main row — always visible */}
            <button
                className="w-full p-4 text-left flex items-start gap-3 active:bg-white/5 transition-colors"
                onClick={handleCardClick}
            >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border shrink-0 ${gradeStyle[item.grade]}`}>
                    {item.grade}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.partName}</p>
                    <p className="text-xs text-secondary mt-0.5">
                        {MATERIAL_LABELS[item.material] ?? item.material}
                        {item.alloyGrade ? ` · ${item.alloyGrade}` : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted">
                            <Clock size={10} /> {relativeTime(item.createdAt)}
                        </span>
                        <span className="text-xs font-medium" style={{ color: '#84cc16' }}>WRI {item.wriScore}</span>
                        {/* Source badge */}
                        {item.source === 'raspberry_pi' ? (
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }}>
                                <Cpu size={8} /> Pi
                            </span>
                        ) : item.source === 'web' ? (
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.10)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.25)' }}>
                                🌐 Web
                            </span>
                        ) : (
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                                📱 Mobile
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>₹{getScanRecoveryValueINR(item).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    {menuOpen
                        ? <X size={14} className="text-muted" />
                        : <ChevronDown size={14} className="text-muted" />}
                </div>
            </button>

            {/* ── Action menu ──────────────────────────────────────────── */}
            {menuOpen && item.fullPayload && (
                <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                    {[
                        { icon: ScanLine, label: t('history.scan_result'), sub: t('history.scan_result_sub'), path: '/scan/result', color: '#60a5fa' },
                        { icon: BookOpen, label: t('history.disassembly'), sub: t('history.disassembly_sub'), path: '/guide', color: '#34d399' },
                        { icon: QrCode, label: t('history.passport'), sub: t('history.passport_sub'), path: '/passport', color: '#f59e0b' },
                    ].map(({ icon: Icon, label, sub, path, color }) => (
                        <button
                            key={path}
                            onClick={() => goTo(path)}
                            className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-white/5 border-b last:border-b-0"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                            >
                                <Icon size={15} style={{ color }} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold text-white">{label}</p>
                                <p className="text-xs text-muted">{sub}</p>
                            </div>
                            <ChevronDown size={13} className="text-muted -rotate-90" />
                        </button>
                    ))}
                </div>
            )}

            {/* Expanded details */}
            {expanded && (
                <div className="px-4 pb-4 border-t pt-3 flex flex-col gap-2.5" style={{ borderColor: 'var(--border)' }}>
                    {/* Confidence */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-elevated)' }}>
                            <p className="text-xs text-muted mb-1">{t('history.part_confidence')}</p>
                            <p className="text-sm font-bold text-white">{Math.round(item.partConfidence * 100)}%</p>
                        </div>
                        <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-elevated)' }}>
                            <p className="text-xs text-muted mb-1">{t('history.mat_confidence')}</p>
                            <p className="text-sm font-bold text-white">{Math.round(item.materialConfidence * 100)}%</p>
                        </div>
                    </div>

                    {/* Condition + Size */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-elevated)' }}>
                            <p className="text-xs text-muted mb-1">{t('history.condition')}</p>
                            <p className="text-sm font-semibold text-white">{SURFACE_LABELS[item.surfaceCondition] ?? item.surfaceCondition}</p>
                        </div>
                        <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-elevated)' }}>
                            <p className="text-xs text-muted mb-1">{t('history.est_mass')}</p>
                            <p className="text-sm font-semibold text-white">
                                {item.estimatedMassKg ? `${item.estimatedMassKg} kg` : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Hazard flags */}
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {item.hazardFlags?.pressurized_component && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                <ShieldAlert size={10} /> {t('history.pressurized')}
                            </span>
                        )}
                        {hasFluidRisk && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
                                <ShieldAlert size={10} /> {t('history.fluid_risk')}
                            </span>
                        )}
                        {item.escalationRequired && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400">
                                <ShieldAlert size={10} /> {t('history.expert_review')}
                            </span>
                        )}
                        {!item.hazardFlags?.pressurized_component && !hasFluidRisk && !item.escalationRequired && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.3)', color: '#84cc16' }}>
                                <CheckCircle size={10} /> {t('history.no_hazards')}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-surface-elevated border border-surface-border text-secondary capitalize">
                            {item.scanMode}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HistoryPage() {
    const router = useRouter();
    const { profile } = useAuth();
    const { t } = useLanguage();
    const [scans, setScans] = useState<ScanRecord[]>(() => {
        const cacheMatchesOrg = historyCache?.orgId === profile?.orgId;
        return cacheMatchesOrg ? (historyCache?.scans ?? []) : [];
    });
    const [loading, setLoading] = useState(() => {
        const cacheMatchesOrg = historyCache?.orgId === profile?.orgId;
        return !cacheMatchesOrg;
    });
    const [exportOpen, setExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!exportOpen) return;
        const handler = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
                setExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [exportOpen]);

    const handleExportCSV = () => {
        setExportOpen(false);
        exportCSV(scans);
    };

    const handleExportPDF = () => {
        setExportOpen(false);
        exportPDF(scans, profile?.orgId ? 'My Organisation' : undefined);
    };

    useEffect(() => {
        setLoading(true);
        // If the user belongs to an org, show only that org's scans
        if (profile?.orgId) {
            const unsub = subscribeToOrgScans(profile.orgId, 200, (data) => {
                setScans(data);
                historyCache = { orgId: profile.orgId ?? undefined, scans: data };
                setLoading(false);
            });
            return () => unsub();
        } else {
            // Personal / guest / anonymous — show their own global recent scans
            const unsub = subscribeToRecentScans(100, (data) => {
                setScans(data);
                historyCache = { orgId: undefined, scans: data };
                setLoading(false);
            });
            return () => unsub();
        }
    }, [profile?.orgId]);

    const stats = computeStats(scans);
    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0">
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-9 h-9 rounded-xl flex items-center justify-center lg:hidden"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    >
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>

                    {/* ── Export Button ── */}
                    <div className="relative ml-auto" ref={exportRef}>
                        <button
                            onClick={() => setExportOpen(o => !o)}
                            disabled={scans.length === 0 || loading}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                            style={{
                                background: scans.length === 0 || loading ? 'var(--bg-elevated)' : 'rgba(132,204,22,0.1)',
                                border: `1px solid ${scans.length === 0 || loading ? 'var(--border)' : 'rgba(132,204,22,0.3)'}`,
                                color: scans.length === 0 || loading ? 'var(--text-muted)' : '#84cc16',
                                cursor: scans.length === 0 || loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <Download size={14} />
                            Export
                            {exportOpen
                                ? <ChevronUp size={13} />
                                : <ChevronDown size={13} />}
                        </button>

                        {/* Dropdown popover */}
                        {exportOpen && (
                            <div
                                className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden shadow-xl"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minWidth: '200px' }}
                            >
                                <div className="px-3 pt-2.5 pb-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                        {scans.length} scan{scans.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={handleExportCSV}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left transition-colors hover:bg-white/5"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
                                        <FileSpreadsheet size={15} style={{ color: '#34D399' }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Export CSV</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Spreadsheet · .csv</p>
                                    </div>
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left transition-colors hover:bg-white/5"
                                    style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)' }}>
                                        <Printer size={15} style={{ color: '#FB923C' }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Export PDF</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Print / Save as PDF</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <FileText size={16} style={{ color: '#F59E0B' }} />
                    </div>
                    <div>
                        <h1 className="page-title text-3xl lg:text-4xl text-white">{t('history.title')}</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {loading ? t('common.loading') : `${scans.length} ${scans.length !== 1 ? t('history.generated_plural') : t('history.generated')}`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 lg:px-10 flex flex-col gap-4 mt-4">
                {/* Summary banner */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="stat-card stat-card-amber p-4 flex flex-col">
                        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{t('history.total_recovery')}</p>
                        {loading
                            ? <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'var(--border)' }} />
                            : <p className="page-title text-2xl" style={{ color: '#F59E0B' }}>₹{stats.totalValueINR.toLocaleString('en-IN')}</p>
                        }
                    </div>
                    <div className="stat-card stat-card-lime p-4 flex flex-col">
                        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{t('history.avg_wri')}</p>
                        {loading
                            ? <div className="h-6 w-12 rounded animate-pulse" style={{ background: 'var(--border)' }} />
                            : <p className="page-title text-2xl" style={{ color: '#84cc16' }}>{scans.length > 0 ? stats.avgWRI : '—'}</p>
                        }
                    </div>
                    <div className="stat-card stat-card-blue p-4 flex flex-col">
                        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{t('history.grade_a_parts')}</p>
                        {loading
                            ? <div className="h-6 w-12 rounded animate-pulse" style={{ background: 'var(--border)' }} />
                            : <p className="page-title text-2xl text-white">{scans.length > 0 ? `${stats.gradeAPct}%` : '—'}</p>
                        }
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="card p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-elevated animate-pulse shrink-0" />
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="h-3.5 w-3/4 rounded bg-surface-elevated animate-pulse" />
                                    <div className="h-2.5 w-1/2 rounded bg-surface-elevated animate-pulse" />
                                </div>
                                <div className="h-4 w-10 rounded bg-surface-elevated animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : scans.length === 0 ? (
                    <div className="card p-8 flex flex-col items-center gap-3 text-center">
                        <FileText size={32} className="text-muted" />
                        <div>
                            <p className="text-sm font-semibold text-secondary">{t('history.no_passports')}</p>
                            <p className="text-xs text-muted mt-1">{t('history.no_passports_sub')}</p>
                        </div>
                        <button
                            onClick={() => router.push('/scan')}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold mt-1"
                            style={{ background: '#84cc16', color: 'var(--bg-primary)' }}
                        >
                            <ScanLine size={14} />
                            {t('common.start_scanning')}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {scans.map((item) => (
                            <ScanCard key={item.id} item={item} />
                        ))}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
