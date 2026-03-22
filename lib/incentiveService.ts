/**
 * incentiveService.ts
 * Points formula:
 *   points = (gradeACount × 10) + (gradeAPct × 0.5) + (co2SavedKg × 2)
 *
 * segregationScore = gradeACount / totalScans × 100  (0–100%)
 * efficiencyTier:  elite ≥85% | good ≥70% | needs_work ≥50% | critical <50%
 */

import { getScanRecoveryValueINR, type ScanRecord } from '@/lib/scanService';

export type EfficiencyTier = 'elite' | 'good' | 'needs_work' | 'critical';

export interface WorkerStats {
    workerId: string;
    workerName: string;
    scansCount: number;
    totalMassKg: number;
    recoveryValueINR: number;
    gradeACount: number;
    gradeBCount: number;
    gradeCCount: number;
    gradeAPct: number;
    co2SavedKg: number;
    points: number;
    rank: number;             // 1-based position on leaderboard
    // Segregation efficiency
    segregationScore: number;     // 0–100
    efficiencyTier: EfficiencyTier;
    efficiencyBadge: string;      // emoji
}

export function getEfficiencyTier(score: number): EfficiencyTier {
    if (score >= 85) return 'elite';
    if (score >= 70) return 'good';
    if (score >= 50) return 'needs_work';
    return 'critical';
}

export const TIER_CONFIG: Record<EfficiencyTier, { label: string; badge: string; color: string; bg: string }> = {
    elite:       { label: 'Elite',       badge: '🏆', color: '#FCD34D', bg: 'rgba(250,204,21,0.12)' },
    good:        { label: 'Good',        badge: '✅', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)'  },
    needs_work:  { label: 'Needs Work',  badge: '⚠️', color: '#FB923C', bg: 'rgba(251,146,60,0.12)' },
    critical:    { label: 'Critical',    badge: '🔴', color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
};

export function computeLeaderboard(scans: ScanRecord[]): WorkerStats[] {
    const map: Record<string, WorkerStats> = {};

    for (const scan of scans) {
        if (!scan.workerId) continue;

        if (!map[scan.workerId]) {
            map[scan.workerId] = {
                workerId: scan.workerId,
                workerName: scan.workerName ?? 'Unknown',
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
            };
        }

        const w = map[scan.workerId];
        w.scansCount += 1;
        w.totalMassKg += scan.estimatedMassKg ?? 0.5;
        w.recoveryValueINR += Math.round(getScanRecoveryValueINR(scan));
        if (scan.grade === 'A') w.gradeACount++;
        if (scan.grade === 'B') w.gradeBCount++;
        if (scan.grade === 'C') w.gradeCCount++;
    }

    return Object.values(map)
        .map(w => {
            w.gradeAPct = w.scansCount > 0 ? Math.round((w.gradeACount / w.scansCount) * 100) : 0;
            w.co2SavedKg = parseFloat((w.totalMassKg * 2.5).toFixed(1));
            w.points = Math.round(
                w.gradeACount * 10 +
                w.gradeAPct * 0.5 +
                w.co2SavedKg * 2,
            );
            w.segregationScore = w.gradeAPct;
            w.efficiencyTier = getEfficiencyTier(w.segregationScore);
            w.efficiencyBadge = TIER_CONFIG[w.efficiencyTier].badge;
            return w;
        })
        .sort((a, b) => b.points - a.points)
        .map((w, i) => { w.rank = i + 1; return w; });
}

export function filterByPeriod(
    scans: ScanRecord[],
    period: 'week' | 'month' | 'all',
): ScanRecord[] {
    if (period === 'all') return scans;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    if (period === 'month') cutoff.setDate(1), cutoff.setHours(0, 0, 0, 0);
    return scans.filter(s => s.createdAt.toDate() >= cutoff);
}

