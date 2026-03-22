'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Trophy, Lock } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { computeLeaderboard, type WorkerStats } from '@/lib/incentiveService';
import { computeBadges, TOTAL_BADGES, type Badge } from '@/lib/badges';
import { type ScanRecord } from '@/lib/scanService';
import BottomNav from '@/components/BottomNav';

const LIME = '#84cc16';
const AMBER = '#f59e0b';

function BadgeCard({ badge }: { badge: Badge }) {
    return (
        <div
            className="rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden transition-all"
            style={{
                background: badge.earned ? 'var(--bg-card)' : 'var(--bg-card)',
                border: badge.earned
                    ? `1px solid ${LIME}35`
                    : '1px solid var(--border)',
                opacity: badge.earned ? 1 : 0.7,
            }}>

            {/* Glow behind earned badge emoji */}
            {badge.earned && (
                <div className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${LIME}14 0%, transparent 70%)`,
                    }} />
            )}

            {/* Emoji + lock */}
            <div className="flex items-start justify-between">
                <span className="text-3xl leading-none" role="img" aria-label={badge.name}>
                    {badge.emoji}
                </span>
                {!badge.earned && <Lock size={12} style={{ color: '#6b7280' }} />}
                {badge.earned && (
                    <div className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                        style={{ background: `${LIME}20`, color: LIME }}>
                        EARNED
                    </div>
                )}
            </div>

            {/* Name + description */}
            <div>
                <p className="text-sm font-bold text-white leading-tight"
                    style={{ fontFamily: 'Space Grotesk' }}>
                    {badge.name}
                </p>
                <p className="text-[11px] mt-1 leading-snug"
                    style={{ color: 'var(--text-dim)' }}>
                    {badge.description}
                </p>
            </div>

            {/* Progress bar */}
            {!badge.earned && (
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            {badge.progressLabel}
                        </span>
                        <span className="text-[9px] font-semibold" style={{ color: AMBER }}>
                            {Math.round(badge.progress * 100)}%
                        </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${badge.progress * 100}%`,
                                background: `linear-gradient(90deg, ${AMBER}, ${LIME})`,
                            }} />
                    </div>
                </div>
            )}

            {badge.earned && (
                <p className="text-[9px] font-semibold" style={{ color: LIME }}>
                    ✓ {badge.progressLabel}
                </p>
            )}
        </div>
    );
}

export default function BadgesPage() {
    const router = useRouter();
    const { user, profile, loading } = useAuth();

    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.replace('/auth'); return; }

        async function load() {
            if (!user) return;
            try {
                // Fetch this worker's scans (within their org if applicable; otherwise all their scans)
                const constraints = profile?.orgId
                    ? [where('orgId', '==', profile.orgId), where('workerId', '==', user.uid), orderBy('createdAt', 'desc')]
                    : [where('workerId', '==', user.uid), orderBy('createdAt', 'desc')];

                const snap = await getDocs(query(collection(db, 'scans'), ...constraints));
                setScans(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScanRecord)));
            } catch (e) {
                console.error('[Badges] fetch failed:', e);
            } finally {
                setFetching(false);
            }
        }
        load();
    }, [user, profile, loading, router]);

    const stats = useMemo<WorkerStats | null>(() => {
        if (!user || scans.length === 0) return null;
        const lb = computeLeaderboard(scans);
        return lb.find(w => w.workerId === user.uid) ?? null;
    }, [scans, user]);

    const badges = useMemo<Badge[]>(() => {
        if (!stats) {
            // Return all badges as locked with 0 progress
            return computeBadges({
                workerId: user?.uid ?? '',
                workerName: '',
                scansCount: 0,
                totalMassKg: 0,
                recoveryValueINR: 0,
                gradeACount: 0,
                gradeBCount: 0,
                gradeCCount: 0,
                gradeAPct: 0,
                co2SavedKg: 0,
                points: 0,
                rank: 0,
                segregationScore: 0,
                efficiencyTier: 'critical',
                efficiencyBadge: '🔴',
            });
        }
        return computeBadges(stats);
    }, [stats, user]);

    const earned = badges.filter(b => b.earned);
    const locked = badges.filter(b => !b.earned);

    if (loading || fetching) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: LIME }} />
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
                    <Trophy size={15} style={{ color: LIME }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                        Achievements
                    </span>
                </div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>My Badges</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                    {earned.length} / {TOTAL_BADGES} badges earned
                </p>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                        style={{
                            width: `${(earned.length / TOTAL_BADGES) * 100}%`,
                            background: `linear-gradient(90deg, ${AMBER}, ${LIME})`,
                        }} />
                </div>

                {/* Stats summary */}
                {stats && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                            { label: 'Scans', value: stats.scansCount },
                            { label: 'Points', value: stats.points },
                            { label: 'CO₂ saved', value: `${stats.co2SavedKg.toFixed(0)} kg` },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl px-3 py-2 text-center"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <p className="text-base font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                                    {s.value}
                                </p>
                                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="px-5 lg:px-10 flex flex-col gap-6 max-w-2xl">

                {/* Earned */}
                {earned.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                            style={{ color: LIME }}>
                            🏅 Earned ({earned.length})
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {earned.map(b => <BadgeCard key={b.id} badge={b} />)}
                        </div>
                    </div>
                )}

                {/* Locked */}
                {locked.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                            style={{ color: 'var(--text-dim)' }}>
                            🔒 Locked ({locked.length})
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {locked.map(b => <BadgeCard key={b.id} badge={b} />)}
                        </div>
                    </div>
                )}

                {/* No scans yet */}
                {scans.length === 0 && (
                    <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <span className="text-4xl">🔬</span>
                        <p className="text-sm font-semibold text-white">Start scanning to earn badges!</p>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            Complete your first scan and your First Scan badge unlocks instantly.
                        </p>
                        <button onClick={() => router.push('/scan')}
                            className="mt-2 px-5 py-2 rounded-xl text-sm font-bold"
                            style={{ background: LIME, color: 'var(--bg-primary)' }}>
                            Go Scan
                        </button>
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
