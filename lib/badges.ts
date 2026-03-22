/**
 * badges.ts
 * ─────────────────────────────────────────────────────────────────────
 * Client-side badge computation — no extra Firestore reads.
 * All inputs come from WorkerStats returned by computeLeaderboard().
 * ─────────────────────────────────────────────────────────────────────
 */

import type { WorkerStats } from '@/lib/incentiveService';

export interface Badge {
    id: string;
    emoji: string;
    name: string;
    description: string;
    earned: boolean;
    /** 0–1 progress towards earning this badge (1 = earned) */
    progress: number;
    /** Human-readable progress label e.g. "7 / 10 scans" */
    progressLabel: string;
}

interface BadgeDef {
    id: string;
    emoji: string;
    name: string;
    description: string;
    check: (s: WorkerStats) => boolean;
    progress: (s: WorkerStats) => number;
    progressLabel: (s: WorkerStats) => string;
}

const BADGE_DEFS: BadgeDef[] = [
    {
        id: 'first_scan',
        emoji: '🔬',
        name: 'First Scan',
        description: 'Complete your very first scan.',
        check: s => s.scansCount >= 1,
        progress: s => Math.min(1, s.scansCount / 1),
        progressLabel: s => `${Math.min(s.scansCount, 1)} / 1 scan`,
    },
    {
        id: 'scan_streak_10',
        emoji: '⚡',
        name: 'Getting Started',
        description: 'Complete 10 scans.',
        check: s => s.scansCount >= 10,
        progress: s => Math.min(1, s.scansCount / 10),
        progressLabel: s => `${Math.min(s.scansCount, 10)} / 10 scans`,
    },
    {
        id: 'scan_streak_50',
        emoji: '🚀',
        name: 'On a Roll',
        description: 'Complete 50 scans.',
        check: s => s.scansCount >= 50,
        progress: s => Math.min(1, s.scansCount / 50),
        progressLabel: s => `${Math.min(s.scansCount, 50)} / 50 scans`,
    },
    {
        id: 'scan_century',
        emoji: '💯',
        name: 'Century Club',
        description: 'Complete 100 scans.',
        check: s => s.scansCount >= 100,
        progress: s => Math.min(1, s.scansCount / 100),
        progressLabel: s => `${Math.min(s.scansCount, 100)} / 100 scans`,
    },
    {
        id: 'grade_a_hunter',
        emoji: '🏆',
        name: 'Grade A Hunter',
        description: 'Earn 10 Grade A recyclability scores.',
        check: s => s.gradeACount >= 10,
        progress: s => Math.min(1, s.gradeACount / 10),
        progressLabel: s => `${Math.min(s.gradeACount, 10)} / 10 Grade A scans`,
    },
    {
        id: 'pure_recycler',
        emoji: '✨',
        name: 'Pure Recycler',
        description: '80% or more of your scans are Grade A.',
        check: s => s.scansCount >= 5 && s.gradeAPct >= 80,
        progress: s => s.scansCount < 5 ? s.scansCount / 5 : Math.min(1, s.gradeAPct / 80),
        progressLabel: s => s.scansCount < 5
            ? `${s.scansCount} / 5 scans first`
            : `${s.gradeAPct}% / 80% Grade A rate`,
    },
    {
        id: 'co2_saver',
        emoji: '🌱',
        name: 'CO₂ Saver',
        description: 'Save 50 kg of CO₂ through recycling.',
        check: s => s.co2SavedKg >= 50,
        progress: s => Math.min(1, s.co2SavedKg / 50),
        progressLabel: s => `${s.co2SavedKg.toFixed(1)} / 50 kg CO₂`,
    },
    {
        id: 'eco_warrior',
        emoji: '🌍',
        name: 'Eco Warrior',
        description: 'Save 200 kg of CO₂ through recycling.',
        check: s => s.co2SavedKg >= 200,
        progress: s => Math.min(1, s.co2SavedKg / 200),
        progressLabel: s => `${s.co2SavedKg.toFixed(1)} / 200 kg CO₂`,
    },
    {
        id: 'recovery_champion',
        emoji: '💰',
        name: 'Recovery Champion',
        description: 'Recover materials worth ₹10,000 or more.',
        check: s => s.recoveryValueINR >= 10000,
        progress: s => Math.min(1, s.recoveryValueINR / 10000),
        progressLabel: s => `₹${Math.min(s.recoveryValueINR, 10000).toLocaleString('en-IN')} / ₹10,000`,
    },
    {
        id: 'points_legend',
        emoji: '👑',
        name: 'Points Legend',
        description: 'Accumulate 500 incentive points.',
        check: s => s.points >= 500,
        progress: s => Math.min(1, s.points / 500),
        progressLabel: s => `${Math.min(s.points, 500)} / 500 pts`,
    },
];

/**
 * Compute all badge states for a given worker.
 * Earned badges come first, then locked ordered by progress desc.
 */
export function computeBadges(stats: WorkerStats): Badge[] {
    const badges = BADGE_DEFS.map<Badge>(def => ({
        id: def.id,
        emoji: def.emoji,
        name: def.name,
        description: def.description,
        earned: def.check(stats),
        progress: def.progress(stats),
        progressLabel: def.progressLabel(stats),
    }));

    return [
        ...badges.filter(b => b.earned),
        ...badges.filter(b => !b.earned).sort((a, b) => b.progress - a.progress),
    ];
}

export { BADGE_DEFS };
export const TOTAL_BADGES = BADGE_DEFS.length;
