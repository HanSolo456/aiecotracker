'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Trophy, Medal, ChevronLeft, ScanLine, Leaf, DollarSign, Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ScanRecord } from '@/lib/scanService';
import { computeLeaderboard, filterByPeriod, TIER_CONFIG, type WorkerStats } from '@/lib/incentiveService';

import BottomNav from '@/components/BottomNav';

// ── Medal colours ─────────────────────────────────────────────────────────────

const MEDAL_STYLE = [
    { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.35)', text: '#FCD34D', label: '1st', icon: '🥇' },
    { bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)',  text: 'var(--text-secondary)', label: '2nd', icon: '🥈' },
    { bg: 'rgba(180,120,60,0.1)',   border: 'rgba(180,120,60,0.3)',   text: '#C97B3A', label: '3rd', icon: '🥉' },
];

type Period = 'week' | 'month' | 'all';

// ── Sub-components ────────────────────────────────────────────────────────────

function PodiumCard({ worker, rank }: { worker: WorkerStats; rank: number }) {
    const m = MEDAL_STYLE[rank] ?? MEDAL_STYLE[2];
    return (
        <div className="flex flex-col items-center gap-2">
            {/* Avatar */}
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
                style={{ background: m.bg, border: `1.5px solid ${m.border}` }}
            >
                {rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉'}
            </div>
            <p className="text-xs font-bold text-white truncate max-w-[72px] text-center">
                {worker.workerName.split(' ')[0]}
            </p>
            <div
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: m.bg, color: m.text, border: `1px solid ${m.border}` }}
            >
                {worker.points} pts
            </div>
        </div>
    );
}

function RankRow({ worker, rank }: { worker: WorkerStats; rank: number }) {
    const isTop3 = rank < 3;
    const m = MEDAL_STYLE[rank];
    const tier = TIER_CONFIG[worker.efficiencyTier];
    return (
        <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
                background: isTop3 ? m.bg : 'var(--bg-card)',
                border: `1px solid ${isTop3 ? m.border : 'var(--border)'}`,
            }}
        >
            {/* Rank badge */}
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                    background: isTop3 ? m.bg : 'var(--border)',
                    color: isTop3 ? m.text : 'var(--text-dim)',
                    border: `1px solid ${isTop3 ? m.border : 'var(--border)'}`,
                }}
            >
                {isTop3 ? m.icon : rank + 1}
            </div>

            {/* Name + bars */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white truncate">{worker.workerName}</span>
                    <span
                        className="text-xs font-bold ml-2 shrink-0"
                        style={{ color: isTop3 ? m.text : '#84cc16' }}
                    >
                        {worker.points} pts
                    </span>
                </div>
                {/* Points bar */}
                <div className="h-1 rounded-full mb-1.5" style={{ background: 'var(--border)' }}>
                    <div
                        className="h-full rounded-full"
                        style={{
                            width: `${Math.min(worker.points, 100)}%`,
                            background: isTop3 ? m.text : '#84cc16',
                            opacity: 0.8,
                        }}
                    />
                </div>
                {/* Segregation efficiency bar */}
                <div className="flex items-center gap-1.5">
                    <div className="h-1 rounded-full flex-1" style={{ background: 'var(--border)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${worker.segregationScore}%`, background: tier.color }}
                        />
                    </div>
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: tier.color }}>
                        {worker.segregationScore}% seg.
                    </span>
                </div>
            </div>

            {/* Efficiency badge + scans */}
            <div className="shrink-0 text-right flex flex-col items-end gap-1">
                <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: tier.bg, color: tier.color }}
                >
                    {tier.badge} {tier.label}
                </span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{worker.scansCount} scans</p>
            </div>
        </div>
    );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
    const router = useRouter();
    const { user, profile, loading } = useAuth();
    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [fetching, setFetching] = useState(true);
    const [period, setPeriod] = useState<Period>('month');

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.replace('/dashboard'); return; }
        if (!profile?.orgId) { router.replace('/dashboard'); return; }

        async function load() {
            if (!profile?.orgId) return;
            try {
                const q = query(
                    collection(db, 'scans'),
                    where('orgId', '==', profile.orgId),
                    orderBy('createdAt', 'desc'),
                );
                const snap = await getDocs(q);
                setScans(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScanRecord)));
            } catch (e) {
                console.error('[Leaderboard] fetch failed:', e);
            } finally {
                setFetching(false);
            }
        }
        load();
    }, [user, profile, loading, router]);

    const filtered  = useMemo(() => filterByPeriod(scans, period), [scans, period]);
    const board     = useMemo(() => computeLeaderboard(filtered), [filtered]);
    const top3      = board.slice(0, 3);
    const rest      = board.slice(3);

    // Org totals for this period
    const totalPts  = board.reduce((s, w) => s + w.points, 0);
    const totalCO2  = board.reduce((s, w) => s + w.co2SavedKg, 0).toFixed(1);
    const totalScans = board.reduce((s, w) => s + w.scansCount, 0);

    const PERIODS: { key: Period; label: string }[] = [
        { key: 'week',  label: 'This Week'  },
        { key: 'month', label: 'This Month' },
        { key: 'all',   label: 'All Time'   },
    ];

    if (loading || fetching) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0" style={{ background: 'var(--bg-primary)' }}>

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => router.back()}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <Trophy size={16} style={{ color: '#FCD34D' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Leaderboard</span>
                </div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                    Worker Rankings
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                    Points = (Grade A × 10) + (A% × 0.5) + (CO₂ kg × 2)
                </p>
            </div>

            {/* Period filter */}
            <div className="px-5 lg:px-10 mb-5">
                <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {PERIODS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setPeriod(key)}
                            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
                            style={{
                                background: period === key ? '#84cc16' : 'transparent',
                                color: period === key ? 'var(--bg-primary)' : 'var(--text-dim)',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-5 lg:px-10 flex flex-col gap-5 max-w-3xl">

                {board.length === 0 ? (
                    <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <Trophy size={32} style={{ color: 'var(--text-muted)' }} />
                        <p className="text-sm font-semibold text-white">No data yet</p>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            Workers need to scan items while logged in for rankings to appear.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Org summary row */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { icon: <ScanLine size={13} />, label: 'Total Scans', value: String(totalScans), color: '#84cc16' },
                                { icon: <Leaf size={13} />,     label: 'CO₂ Saved',   value: `${totalCO2} kg`,  color: '#34D399' },
                                { icon: <Zap size={13} />,      label: 'Total Points', value: String(totalPts),  color: '#FCD34D' },
                            ].map(({ icon, label, value, color }) => (
                                <div key={label} className="rounded-2xl p-4 flex flex-col gap-2"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                            style={{ background: `${color}18` }}>
                                            <span style={{ color }}>{icon}</span>
                                        </div>
                                        <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{label}</span>
                                    </div>
                                    <p className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Podium (top 3) */}
                        {top3.length >= 2 && (
                            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-5 text-center"
                                    style={{ color: 'var(--text-dim)' }}>Top Performers</p>
                                <div className="flex items-end justify-center gap-6">
                                    {/* Silver — 2nd */}
                                    {top3[1] && (
                                        <div className="mb-2"><PodiumCard worker={top3[1]} rank={1} /></div>
                                    )}
                                    {/* Gold — 1st (tallest) */}
                                    <div className="mb-6"><PodiumCard worker={top3[0]} rank={0} /></div>
                                    {/* Bronze — 3rd */}
                                    {top3[2] && (
                                        <div><PodiumCard worker={top3[2]} rank={2} /></div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Full ranked list */}
                        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                            <div className="px-4 py-3 flex items-center gap-2"
                                style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                                <Medal size={13} style={{ color: '#84cc16' }} />
                                <p className="text-xs font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>All Rankings</p>
                            </div>
                            <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--bg-card)' }}>
                                {board.map((worker, i) => (
                                    <RankRow key={worker.workerId} worker={worker} rank={i} />
                                ))}
                            </div>
                        </div>

                        {/* Points breakdown explainer */}
                        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <p className="text-xs font-bold text-white mb-3" style={{ fontFamily: 'Space Grotesk' }}>
                                How Points Are Calculated
                            </p>
                            <div className="flex flex-col gap-2">
                                {[
                                    { icon: '🏆', label: 'Each Grade A scan', pts: '+10 pts' },
                                    { icon: '📊', label: 'Grade A percentage', pts: '+0.5 per %' },
                                    { icon: '🌿', label: 'CO₂ saved', pts: '+2 per kg' },
                                ].map(({ icon, label, pts }) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{icon}</span>
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                                        </div>
                                        <span className="text-xs font-bold" style={{ color: '#84cc16' }}>{pts}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
