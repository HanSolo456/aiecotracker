'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, Zap, Leaf, TrendingUp, ChevronRight, ShieldCheck, Activity, Wind, LogOut, Trophy, Star, Award, BarChart3, User, ArrowRight, Cpu, Package, Clock } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { subscribeToRecentScans, subscribeToOrgScans, subscribeToWorkerScans, computeStats, getScanRecoveryValueINR, relativeTime, type ScanRecord } from '@/lib/scanService';
import { computeLeaderboard } from '@/lib/incentiveService';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/components/LanguageProvider';

const gradeColor: Record<string, string> = {
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

function WRIRing({ score }: { score: number }) {
    const r = 18;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(Math.max(score / 100, 0), 1);
    const offset = circ * (1 - pct);
    const color = score >= 70 ? '#84cc16' : score >= 40 ? '#F59E0B' : '#EF4444';
    return (
        <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
            <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
            <circle
                cx="22" cy="22" r={r} fill="none"
                stroke={color} strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            <text x="22" y="26" textAnchor="middle" fill={color} fontSize="9" fontFamily="Space Grotesk" fontWeight="700">
                {score}
            </text>
        </svg>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, profile, signOut } = useAuth();
    const { t } = useLanguage();
    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [orgScans, setOrgScans] = useState<ScanRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [sensor, setSensor] = useState<{ fillLevel: number; gasPpm: number; temperature: number; gasAlert: boolean; lastSeenMs?: number } | null>(null);
    const [statPeriod, setStatPeriod] = useState<'month' | 'all'>('month');

    const isWorker = profile?.role === 'worker' && !!profile?.orgId;

    useEffect(() => {
        const orgId = profile?.orgId;
        const workerId = user?.uid;
        let unsub: () => void;
        let unsubOrg: (() => void) | undefined;

        if (isWorker && orgId && workerId) {
            // Worker: personal scans + org scans (to compute leaderboard rank)
            unsub = subscribeToWorkerScans(orgId, workerId, 200, (data) => { setScans(data); setLoading(false); });
            unsubOrg = subscribeToOrgScans(orgId, 500, (data) => setOrgScans(data));
        } else if (orgId) {
            unsub = subscribeToOrgScans(orgId, 50, (data) => { setScans(data); setLoading(false); });
        } else {
            unsub = subscribeToRecentScans(50, (data) => { setScans(data); setLoading(false); });
        }

        const sensorQ = query(collection(db, 'sensor_readings'), orderBy('createdAt', 'desc'), limit(1));
        const unsubSensor = onSnapshot(sensorQ, (snap) => {
            if (!snap.empty) {
                const d = snap.docs[0].data();
                const createdAt = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
                setSensor({ fillLevel: d.fillLevel ?? 0, gasPpm: d.gasPpm ?? 0, temperature: d.temperature ?? 0, gasAlert: d.gasAlert ?? false, lastSeenMs: createdAt });
            }
        }, (err) => console.warn('[dashboard] sensor error:', err.code));
        return () => { unsub(); unsubOrg?.(); unsubSensor(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.orgId, profile?.role, user?.uid]);

    const stats        = computeStats(scans);
    const recentScans  = scans.slice(0, 5);
    const fillColor    = !sensor ? '#84cc16' : sensor.fillLevel > 80 ? '#EF4444' : sensor.fillLevel > 50 ? '#F59E0B' : '#84cc16';
    const totalMassKg  = scans.reduce((sum, s) => sum + (s.estimatedMassKg ?? 0.5), 0);
    const co2SavedKg   = (totalMassKg * 2.5).toFixed(1);
    const sensorIsStale = !!sensor && (Date.now() - (sensor.lastSeenMs ?? 0)) > 5 * 60 * 1000;
    const sensorIsLive  = !!sensor && !sensorIsStale;

    // ── Worker-specific computed stats ────────────────────────────────────────
    const now = new Date();
    const periodScans = statPeriod === 'month'
        ? scans.filter(s => { const d = s.createdAt.toDate(); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
        : scans;

    const myScansCount    = periodScans.length;
    const myTotalMassKg   = periodScans.reduce((sum, s) => sum + (s.estimatedMassKg ?? 0.5), 0);
    const myCo2Saved      = (myTotalMassKg * 2.5).toFixed(1);
    const myRecoveryInr   = Math.round(periodScans.reduce((sum, s) => sum + getScanRecoveryValueINR(s), 0));
    const myGradeA        = periodScans.filter(s => s.grade === 'A').length;
    const myGradeB        = periodScans.filter(s => s.grade === 'B').length;
    const myGradeC        = periodScans.filter(s => s.grade === 'C').length;
    const myGradeAPct     = myScansCount > 0 ? Math.round((myGradeA / myScansCount) * 100) : 0;

    // Leaderboard rank — computed from ALL org scans
    const leaderboard     = computeLeaderboard(orgScans);
    const myRank          = leaderboard.findIndex(w => w.workerId === user?.uid) + 1;
    const myPoints        = leaderboard.find(w => w.workerId === user?.uid)?.points ?? 0;
    const totalWorkers    = leaderboard.length;

    // Streak — consecutive calendar days with at least 1 scan
    const streak = (() => {
        if (scans.length === 0) return 0;
        const days = new Set(scans.map(s => s.createdAt.toDate().toDateString()));
        let count = 0;
        const d = new Date();
        while (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
        return count;
    })();

    // Milestone badges
    const allTimeScans    = scans.length;
    const allTimeCo2      = parseFloat((scans.reduce((sum, s) => sum + (s.estimatedMassKg ?? 0.5), 0) * 2.5).toFixed(1));
    const badges = [
        { id: 'first', icon: '🌱', label: t('dashboard.badge_first'), earned: allTimeScans >= 1 },
        { id: 's10',   icon: '⚡', label: t('dashboard.badge_10'),    earned: allTimeScans >= 10 },
        { id: 's50',   icon: '🔥', label: t('dashboard.badge_50'),    earned: allTimeScans >= 50 },
        { id: 'co2_5', icon: '🌿', label: t('dashboard.badge_co2_5'), earned: allTimeCo2 >= 5 },
        { id: 'co2_25',icon: '🌎', label: t('dashboard.badge_co2_25'),earned: allTimeCo2 >= 25 },
        { id: 'gradeA',icon: '⭐', label: t('dashboard.badge_grade_a'),earned: scans.some(s => s.grade === 'A') },
        { id: 'top3',  icon: '🏆', label: t('dashboard.badge_top3'),  earned: myRank > 0 && myRank <= 3 },
    ];

    // ── Worker Dashboard ──────────────────────────────────────────────────────
    if (isWorker) {
        const workerName  = profile?.displayName ?? user?.displayName ?? 'Worker';
        const initials    = workerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        const rankLabel   = myRank === 0 ? '—' : `#${myRank}`;
        const rankColor   = myRank === 1 ? '#F59E0B' : myRank === 2 ? 'var(--text-secondary)' : myRank === 3 ? '#CD7F32' : '#60A5FA';

        return (
            <div className="flex flex-col min-h-screen pb-28 lg:pb-0">

                {/* ── Header ── */}
                <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2 lg:hidden">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)' }}>
                                <Leaf size={13} style={{ color: '#84cc16' }} />
                            </div>
                            <span className="page-label">AI-EcoTrack</span>
                        </div>
                        <button
                            onClick={async () => { await signOut(); router.replace('/auth'); }}
                            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                        >
                            <LogOut size={13} /> {t('common.sign_out')}
                        </button>
                    </div>

                    {/* Worker hero card */}
                    <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
                        style={{ background: 'linear-gradient(135deg, rgba(132,204,22,0.08) 0%, rgba(96,165,250,0.06) 100%)', border: '1px solid rgba(132,204,22,0.15)' }}>
                        {/* Avatar */}
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-lg font-bold"
                            style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.25)', color: '#84cc16', fontFamily: 'Space Grotesk' }}>
                            {initials || <User size={20} style={{ color: '#84cc16' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold truncate" style={{ fontFamily: 'Space Grotesk' }}>{workerName}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{t('dashboard.worker_label')} · {allTimeScans} {t('dashboard.scans_total')}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: `${rankColor}18`, border: `1px solid ${rankColor}40`, color: rankColor }}>
                                    {rankLabel} {t('dashboard.in_org')}
                                </span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
                                    ⚡ {myPoints} pts
                                </span>
                            </div>
                        </div>
                        <button onClick={() => router.push('/org/leaderboard')}
                            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-90"
                            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
                            <Trophy size={16} style={{ color: '#FBBF24' }} />
                        </button>
                    </div>
                </div>

                {/* ── Primary CTA + Quick Links ── */}
                <div className="px-5 lg:px-10 mb-4">
                    {/* Big Scan Button */}
                    <button
                        onClick={() => router.push('/scan')}
                        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] mb-3"
                        style={{ background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)', color: '#020617', boxShadow: '0 4px 24px rgba(132,204,22,0.25)' }}
                    >
                        <ScanLine size={18} /> {t('dashboard.start_scan')}
                    </button>

                    {/* Row: Org Dashboard pill + streak */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.push('/org/dashboard')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                            style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)', color: '#60A5FA' }}>
                            <Activity size={12} /> {t('dashboard.org_dashboard')}
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                            style={{ background: streak > 0 ? 'rgba(251,146,60,0.08)' : 'var(--bg-card)', border: `1px solid ${streak > 0 ? 'rgba(251,146,60,0.25)' : 'var(--border)'}` }}>
                            <span className="text-base">{streak > 0 ? '🔥' : '💤'}</span>
                            <span className="text-xs font-bold" style={{ color: streak > 0 ? '#FB923C' : 'var(--text-muted)' }}>
                                {streak}d streak
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Period Toggle ── */}
                <div className="px-5 lg:px-10 mb-4">
                    <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        {(['month', 'all'] as const).map(p => (
                            <button key={p}
                                onClick={() => setStatPeriod(p)}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                style={statPeriod === p
                                    ? { background: '#84cc16', color: '#020617' }
                                    : { color: 'var(--text-muted)' }}
                            >
                                {p === 'month' ? t('common.this_month') : t('common.all_time')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── KPI Row ── */}
                <div className="px-5 lg:px-10 mb-4 grid grid-cols-3 gap-3">
                    {[
                        { label: t('dashboard.scans'),    value: myScansCount,                            icon: <ScanLine size={13} style={{ color: '#84cc16' }} />, accent: '#84cc16' },
                        { label: t('dashboard.co2_saved'),value: `${myCo2Saved} kg`,                      icon: <Wind size={13} style={{ color: '#60A5FA' }} />, accent: '#60A5FA' },
                        { label: t('dashboard.recovery'), value: `₹${myRecoveryInr.toLocaleString('en-IN')}`, icon: <TrendingUp size={13} style={{ color: '#F59E0B' }} />, accent: '#F59E0B' },
                    ].map(({ label, value, icon, accent }) => (
                        <div key={label} className="rounded-2xl p-3 flex flex-col gap-1.5"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{ background: `${accent}12` }}>{icon}</div>
                            <p className="text-base font-bold text-white leading-none" style={{ fontFamily: 'Space Grotesk' }}>{loading ? t('common.no_data') : value}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Grade Breakdown ── */}
                {myScansCount > 0 && (
                    <div className="px-5 lg:px-10 mb-4">
                        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-1.5 mb-3">
                                <BarChart3 size={13} style={{ color: '#84cc16' }} />
                                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.grade_breakdown')}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {[
                                    { grade: 'A', count: myGradeA, color: '#84cc16',  bg: 'rgba(132,204,22,0.12)' },
                                    { grade: 'B', count: myGradeB, color: '#F59E0B',  bg: 'rgba(245,158,11,0.12)' },
                                    { grade: 'C', count: myGradeC, color: '#EF4444',  bg: 'rgba(239,68,68,0.12)'  },
                                ].map(({ grade, count, color, bg }) => {
                                    const pct = myScansCount > 0 ? Math.round((count / myScansCount) * 100) : 0;
                                    return (
                                        <div key={grade} className="flex items-center gap-3">
                                            <span className="text-xs font-bold w-5 text-center rounded px-1"
                                                style={{ background: bg, color }}>{grade}</span>
                                            <div className="flex-1 rounded-full h-1.5" style={{ background: 'var(--border)' }}>
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${pct}%`, background: color }} />
                                            </div>
                                            <span className="text-xs w-8 text-right" style={{ color: 'var(--text-muted)' }}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Milestone Badges ── */}
                <div className="px-5 lg:px-10 mb-4">
                    <p className="page-label mb-2.5">{t('dashboard.badges')}</p>
                    <div className="flex gap-2 flex-wrap">
                        {badges.map(b => (
                            <div key={b.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                                style={b.earned
                                    ? { background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.25)', color: '#84cc16' }
                                    : { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', opacity: 0.65 }}
                            >
                                <span>{b.icon}</span> {b.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Recent Scans ── */}
                <div className="px-5 lg:px-10 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="page-label">{t('dashboard.recent_scans')}</p>
                        <button onClick={() => router.push('/history')}
                            className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-dim)' }}>
                            {t('common.view_all')} <ChevronRight size={12} />
                        </button>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 rounded-full border-2 animate-spin"
                                style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
                        </div>
                    ) : scans.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <ScanLine size={28} style={{ color: 'var(--border)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.no_scans')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {recentScans.map(scan => {
                                const gradeColors: Record<string, { bg: string; color: string }> = {
                                    A: { bg: 'rgba(132,204,22,0.12)', color: '#84cc16' },
                                    B: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
                                    C: { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444' },
                                };
                                const gc = gradeColors[scan.grade] ?? gradeColors.C;
                                return (
                                    <button
                                        key={scan.id}
                                        onClick={() => { if (scan.id) { import('@/lib/scanService').then(m => m.restoreScanToSession(scan)); router.push('/scan/result'); } }}
                                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:opacity-90"
                                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ background: 'rgba(132,204,22,0.08)' }}>
                                            <ShieldCheck size={14} style={{ color: '#84cc16' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{scan.partName}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{scan.material} · {relativeTime(scan.createdAt)}</p>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1.5">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                                style={{ background: gc.bg, color: gc.color }}>{scan.grade}</span>
                                            <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Bottom Leaderboard shortcut ── */}
                <div className="px-5 lg:px-10 mb-5">
                    <button onClick={() => router.push('/org/leaderboard')}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
                        style={{ background: 'var(--bg-card)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBBF24' }}>
                        <Trophy size={14} /> {t('dashboard.leaderboard')}
                    </button>
                </div>

                <BottomNav />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0">

            {/* ── Page Header ───────────────────────────────────────── */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                <div className="flex items-center justify-between mb-4">
                    {/* Mobile-only logo */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)' }}>
                            <Leaf size={13} style={{ color: '#84cc16' }} />
                        </div>
                        <span className="page-label">AI-EcoTrack</span>
                    </div>

                    {/* Mobile-only auth button */}
                    <div className="lg:hidden">
                        {user && !user.isAnonymous ? (
                            <button
                                onClick={async () => { await signOut(); router.replace('/auth'); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                                title="Sign out"
                            >
                                <LogOut size={13} />
                                Sign Out
                            </button>
                        ) : user?.isAnonymous ? (
                            <button
                                onClick={() => router.push('/auth')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                                style={{ background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.3)', color: '#84cc16' }}
                            >
                                Sign In
                            </button>
                        ) : null}
                    </div>
                </div>

                <h1 className="page-title text-3xl lg:text-4xl text-white">
                    {t('dashboard.title').split(' ').slice(0, 2).join(' ')} <span style={{ color: '#84cc16' }}>{t('dashboard.title').split(' ').slice(2).join(' ')}</span>
                </h1>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-dim)', fontFamily: 'DM Sans' }}>
                    {t('dashboard.subtitle')}
                </p>
            </div>

            {/* ── Guest banner ────────────────────────────────────── */}
            {user?.isAnonymous && (
                <div className="mx-5 lg:mx-10 mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                    style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                    <p className="text-sm" style={{ color: '#93C5FD' }}>
                        👋 {t('dashboard.guest_banner')}
                    </p>
                    <button
                        onClick={() => router.push('/auth')}
                        className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                        style={{ background: '#60A5FA', color: 'var(--bg-primary)' }}
                    >
                        {t('nav.sign_in')}
                    </button>
                </div>
            )}

            <div className="lg:px-10 lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">

                {/* ── LEFT COLUMN ──────────────────────────────────── */}
                <div>
                    {/* KPI Row */}
                    <div className="px-5 lg:px-0 mb-5 grid grid-cols-2 gap-3">
                        {/* Parts Scanned */}
                        <div className="stat-card stat-card-lime p-4">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3"
                                style={{ background: 'rgba(132,204,22,0.1)' }}>
                                <Activity size={14} style={{ color: '#84cc16' }} />
                            </div>
                            {loading
                                ? <div className="h-7 w-10 rounded" style={{ background: 'var(--border)', animation: 'pulse 1.5s infinite' }} />
                                : <p className="page-title text-2xl text-white">{stats.scannedToday}</p>
                            }
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.parts_today')}</p>
                        </div>

                        {/* Avg WRI */}
                        <div className="stat-card stat-card-amber p-4">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3"
                                style={{ background: 'rgba(245,158,11,0.1)' }}>
                                <TrendingUp size={14} style={{ color: '#F59E0B' }} />
                            </div>
                            {loading
                                ? <div className="h-7 w-10 rounded" style={{ background: 'var(--border)', animation: 'pulse 1.5s infinite' }} />
                                : <p className="page-title text-2xl text-white">{scans.length > 0 ? stats.avgWRI : '—'}</p>
                            }
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.avg_wri')}</p>
                        </div>

                        {/* Recovery Value */}
                        <div className="stat-card stat-card-blue p-4">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3"
                                style={{ background: 'rgba(96,165,250,0.1)' }}>
                                <Zap size={14} style={{ color: '#60A5FA' }} />
                            </div>
                            {loading
                                ? <div className="h-7 w-12 rounded" style={{ background: 'var(--border)', animation: 'pulse 1.5s infinite' }} />
                                : <p className="page-title text-2xl text-white">₹{stats.totalValueINR.toLocaleString('en-IN')}</p>
                            }
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.recovery_value')}</p>
                        </div>

                        {/* CO2 Saved */}
                        <div className="stat-card p-4" style={{ borderColor: 'rgba(132,204,22,0.25)', background: 'rgba(132,204,22,0.04)' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3"
                                style={{ background: 'rgba(132,204,22,0.12)' }}>
                                <Leaf size={14} style={{ color: '#84cc16' }} />
                            </div>
                            {loading
                                ? <div className="h-7 w-12 rounded" style={{ background: 'var(--border)', animation: 'pulse 1.5s infinite' }} />
                                : <p className="page-title text-2xl" style={{ color: '#84cc16' }}>{stats.co2SavedKg}<span className="text-sm font-sans font-normal ml-0.5" style={{ color: 'var(--text-secondary)' }}>kg</span></p>
                            }
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.co2_saved')}</p>
                        </div>
                    </div>

                    {/* Scan CTA */}
                    <div className="px-5 lg:px-0 mb-5">
                        <button
                            onClick={() => router.push('/scan')}
                            className="relative w-full overflow-hidden rounded-2xl p-5 text-left group"
                            style={{
                                background: 'linear-gradient(135deg, color-mix(in srgb, var(--lime) 24%, var(--bg-card) 76%) 0%, var(--bg-card) 60%, var(--bg-elevated) 100%)',
                                border: '1px solid rgba(132,204,22,0.3)',
                                boxShadow: '0 0 40px rgba(132,204,22,0.08)',
                            }}
                        >
                            {/* Radial glow */}
                            <div className="absolute right-0 top-0 w-48 h-48 opacity-20 pointer-events-none"
                                style={{ background: 'radial-gradient(circle, #84cc16 0%, transparent 65%)', transform: 'translate(30%,-30%)' }} />

                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 animate-pulse-ring"
                                    style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.4)' }}>
                                    <ScanLine size={24} style={{ color: '#84cc16' }} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs mb-0.5" style={{ color: '#84cc16', fontFamily: 'DM Sans', fontWeight: 600, letterSpacing: '0.1em' }}>{t('dashboard.scan_cta_label')}</p>
                                    <p className="page-title text-lg text-white">{t('dashboard.scan_cta_title')}</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                        {t('dashboard.scan_cta_sub')}
                                    </p>
                                </div>
                                <ArrowRight size={20} style={{ color: '#84cc16' }} className="shrink-0 group-hover:translate-x-1 transition-transform duration-200" />
                            </div>

                            <div className="relative z-10 mt-4 flex items-center h-11 rounded-xl"
                                style={{ background: '#84cc16' }}>
                                <ScanLine size={16} className="ml-4" style={{ color: 'var(--bg-primary)' }} />
                                <span className="ml-2 font-heading font-700 text-sm" style={{ color: 'var(--bg-primary)' }}>{t('dashboard.start_scanning')}</span>
                            </div>
                        </button>
                    </div>

                    {/* Safety Banner */}
                    <div className="px-5 lg:px-0 mb-5">
                        <div className="flex items-center gap-3 p-3.5 rounded-xl"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(132,204,22,0.08)' }}>
                                <ShieldCheck size={16} style={{ color: '#84cc16' }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-white">{t('dashboard.compliance')}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.compliance_sub')}</p>
                            </div>
                            <span className="text-xs font-bold shrink-0" style={{ color: '#84cc16' }}>{t('dashboard.active')}</span>
                        </div>
                    </div>

                    {/* Recent Passports */}
                    <div className="px-5 lg:px-0 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-heading text-base font-700 text-white">{t('dashboard.recent_passports')}</h2>
                            <button
                                className="flex items-center gap-1 text-xs"
                                style={{ color: 'var(--text-secondary)' }}
                                onClick={() => router.push('/history')}
                            >
                                {t('common.view_all')} <ChevronRight size={12} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex flex-col gap-3">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="card p-4 flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-surface-elevated animate-pulse shrink-0" />
                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="h-3.5 w-3/4 rounded bg-surface-elevated animate-pulse" />
                                            <div className="h-2.5 w-1/2 rounded bg-surface-elevated animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentScans.length === 0 ? (
                            <div className="card p-8 flex flex-col items-center gap-2 text-center">
                                <ScanLine size={28} style={{ color: 'var(--text-muted)' }} />
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.no_scans_yet')}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.scan_first')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {recentScans.map((scan) => (
                                    <button
                                        key={scan.id}
                                        className="card-hover p-4 text-left flex items-center gap-3 w-full"
                                        onClick={() => router.push('/history')}
                                    >
                                        {/* WRI Ring */}
                                        <WRIRing score={scan.wriScore} />

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{scan.partName}</p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                {MATERIAL_LABELS[scan.material] ?? scan.material}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    <Clock size={10} /> {relativeTime(scan.createdAt)}
                                                </span>
                                                <span
                                                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${gradeColor[scan.grade]}`}
                                                >
                                                    {scan.grade}
                                                </span>
                                                <span className="text-xs font-semibold" style={{ color: '#84cc16' }}>
                                                    ₹{Math.round(getScanRecoveryValueINR(scan)).toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN (desktop only) ──────────────────── */}
                <div className="hidden lg:block">

                    {/* Live IoT Widget */}
                    {sensor && (
                        <div className="mb-5">
                            <button
                                onClick={() => router.push('/iot-monitor')}
                                className="w-full card-hover p-5 text-left"
                                style={{ border: sensor.gasAlert ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(96,165,250,0.2)' }}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                            style={{ background: 'rgba(96,165,250,0.1)' }}>
                                            <Cpu size={14} style={{ color: '#60A5FA' }} />
                                        </div>
                                        <span className="text-sm font-semibold text-white">Live Bin Status</span>
                                        <span className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${sensorIsLive ? 'bg-[#84cc16] animate-pulse' : 'bg-red-400'}`} />
                                            <span className="text-xs" style={{ color: sensorIsLive ? '#84cc16' : '#F87171' }}>{sensorIsLive ? t('dashboard.live') : t('dashboard.offline')}</span>
                                        </span>
                                    </div>
                                    {sensor.gasAlert && (
                                        <span className="text-xs text-red-400 font-semibold">⚠ Gas Alert</span>
                                    )}
                                </div>

                                {/* Bin fill — vertical tank */}
                                <div className="flex items-end gap-5 mb-4">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="relative w-12 h-24 rounded-xl overflow-hidden"
                                            style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
                                            <div
                                                className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-all duration-700"
                                                style={{ height: `${sensor.fillLevel}%`, background: fillColor, opacity: 0.8 }}
                                            />
                                        </div>
                                        <p className="text-lg font-heading font-700" style={{ color: fillColor }}>{sensor.fillLevel}%</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.fill')}</p>
                                    </div>

                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                            <div className="flex items-center gap-1 mb-1">
                                                <Wind size={11} style={{ color: 'var(--text-secondary)' }} />
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.gas_ppm')}</span>
                                            </div>
                                            <p className={`text-xl font-heading font-700 ${sensor.gasPpm > 400 ? 'text-red-400' : sensor.gasPpm > 250 ? 'text-amber-400' : 'text-white'}`}>
                                                {sensor.gasPpm}
                                            </p>
                                            <p className={`text-xs mt-0.5 ${sensor.gasPpm > 400 ? 'text-red-400' : sensor.gasPpm > 250 ? 'text-amber-400' : ''}`}
                                                style={sensor.gasPpm <= 250 ? { color: '#84cc16' } : {}}>
                                                {sensor.gasPpm > 400 ? t('dashboard.gas_danger') : sensor.gasPpm > 250 ? t('dashboard.gas_elevated') : t('dashboard.gas_normal')}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                            <div className="flex items-center gap-1 mb-1">
                                                <Activity size={11} style={{ color: 'var(--text-secondary)' }} />
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.temp')}</span>
                                            </div>
                                            <p className="text-xl font-heading font-700 text-white">{sensor.temperature.toFixed(0)}°C</p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>DHT-11</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-1 text-xs" style={{ color: '#60A5FA' }}>
                                    {t('dashboard.view_sensor')} <ArrowRight size={12} />
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Mobile IoT widget (no sensor) placeholder */}
                    {!sensor && (
                        <div className="mb-5 card p-5 flex flex-col items-center gap-2 text-center">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <Cpu size={18} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.no_iot')}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.no_iot_sub')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile-only IoT widget — hidden for anonymous guests */}
            {sensor && !user?.isAnonymous && (
                <div className="px-5 mb-5 lg:hidden">
                    <button
                        onClick={() => router.push('/iot-monitor')}
                        className="w-full card p-4 text-left"
                        style={{ border: sensor.gasAlert ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(96,165,250,0.2)' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                    style={{ background: 'rgba(96,165,250,0.1)' }}>
                                    <Cpu size={12} style={{ color: '#60A5FA' }} />
                                </div>
                                <span className="text-xs font-semibold text-white">Live Bin Status</span>
                                <span className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${sensorIsLive ? 'bg-[#84cc16] animate-pulse' : 'bg-red-400'}`} />
                                        </span>
                            </div>
                            {sensor.gasAlert && <span className="text-xs text-red-400 font-semibold">⚠ Gas Alert</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <div className="flex items-center gap-1 mb-1">
                                    <Package size={10} style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.fill')}</span>
                                </div>
                                <p className="text-lg font-heading font-700" style={{ color: fillColor }}>{sensor.fillLevel}%</p>
                                <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--border)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${sensor.fillLevel}%`, background: fillColor }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-1 mb-1">
                                    <Wind size={10} style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.gas_ppm')}</span>
                                </div>
                                <p className={`text-lg font-heading font-700 ${sensor.gasPpm > 400 ? 'text-red-400' : sensor.gasPpm > 250 ? 'text-amber-400' : 'text-white'}`}>
                                    {sensor.gasPpm}
                                </p>
                            </div>
                            <div>
                                <div className="flex items-center gap-1 mb-1">
                                    <Activity size={10} style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.temp')}</span>
                                </div>
                                <p className="text-lg font-heading font-700 text-white">{sensor.temperature.toFixed(0)}°C</p>
                            </div>
                        </div>
                        <p className="text-xs mt-3 text-right" style={{ color: '#60A5FA' }}>{t('dashboard.view_sensor')} →</p>
                    </button>
                </div>
            )}

            <BottomNav />
        </div>
    );
}
