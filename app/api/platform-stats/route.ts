import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';

// CO₂ factors kg per kg material (EPA / IPCC)
const CO2_FACTOR: Record<string, number> = {
    aluminum: 9.16, pcb: 3.10, ewaste: 4.20,
    plastic: 2.53, default: 2.50, metal: 1.46,
    glass: 0.31, paper: 1.08, battery: 5.40,
};

function normaliseMaterial(raw: string | undefined): string {
    if (!raw) return 'default';
    const s = raw.toLowerCase();
    if (s.includes('alum')) return 'aluminum';
    if (s.includes('pcb') || s.includes('circuit')) return 'pcb';
    if (s.includes('plastic')) return 'plastic';
    if (s.includes('glass')) return 'glass';
    if (s.includes('paper') || s.includes('cardboard')) return 'paper';
    if (s.includes('battery')) return 'battery';
    if (s.includes('metal') || s.includes('steel') || s.includes('iron')) return 'metal';
    if (s.includes('ewaste') || s.includes('electronic')) return 'ewaste';
    return 'default';
}

function getRecoveryValueINR(d: FirebaseFirestore.DocumentData): number {
    if (d.dpp && d.dpp !== '{}' && d.dpp !== 'null') {
        try {
            const dpp = JSON.parse(d.dpp as string);
            const val = dpp?.material_composition?.total_theoretical_recovery_value_usd;
            if (typeof val === 'number' && Number.isFinite(val) && val >= 0) return Math.round(val * 100) / 100;
        } catch { /* ignore */ }
    }
    return Math.round(((d.recoveryValueUSD as number) ?? 0) * 83.5 * 100) / 100;
}

// Cache result for 10 minutes to avoid hitting Firestore on every landing page load
let cache: { data: object; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET() {
    try {
        // Serve from cache if fresh
        if (cache && Date.now() < cache.expiresAt) {
            return NextResponse.json(cache.data, {
                headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
            });
        }

        initializeAdmin();
        const db = getFirestore();

        // ── Aggregate all scans (platform-wide, no org filter) ──────────────
        const scansSnap = await db.collection('scans').get();

        let totalScans    = 0;
        let totalMassKg   = 0;
        let totalCO2Kg    = 0;
        let totalValueINR = 0;
        let gradeACount   = 0;
        let hazardCount   = 0;
        const byMaterial: Record<string, number> = {};
        const byDay: Record<string, { scans: number; co2: number }> = {};

        for (const doc of scansSnap.docs) {
            const d = doc.data();
            const mat  = normaliseMaterial(d.material ?? '');
            const mass = (d.estimatedMassKg as number) ?? 0.5;
            const co2  = mass * (CO2_FACTOR[mat] ?? CO2_FACTOR.default);
            const val  = getRecoveryValueINR(d);
            const day  = d.createdAt?.toDate?.()?.toISOString().slice(0, 10) ?? '2024-01-01';

            totalScans++;
            totalMassKg   += mass;
            totalCO2Kg    += co2;
            totalValueINR += val;
            if (d.grade === 'A') gradeACount++;
            if (d.escalationRequired) hazardCount++;

            byMaterial[mat] = (byMaterial[mat] ?? 0) + 1;
            byDay[day] = byDay[day] ?? { scans: 0, co2: 0 };
            byDay[day].scans++;
            byDay[day].co2 += co2;
        }

        // Count orgs
        const orgsSnap = await db.collection('orgs').get();
        const activeOrgs = orgsSnap.size;

        // Trend — last 30 days
        const trend = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-30)
            .map(([date, v]) => ({ date, scans: v.scans, co2Kg: +v.co2.toFixed(2) }));

        // Top materials
        const topMaterials = Object.entries(byMaterial)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([name, count]) => ({ name, count }));

        const data = {
            totals: {
                scans:       totalScans,
                massKg:      +totalMassKg.toFixed(1),
                co2Kg:       +totalCO2Kg.toFixed(1),
                valueINR:    Math.round(totalValueINR),
                gradeAPct:   totalScans > 0 ? Math.round((gradeACount / totalScans) * 100) : 0,
                hazardFlags: hazardCount,
                activeOrgs,
            },
            trend,
            topMaterials,
            generatedAt: new Date().toISOString(),
        };

        cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };

        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
        });
    } catch (err) {
        console.error('[platform-stats] error:', err);
        // Return zeros rather than 500 — landing page should always work
        return NextResponse.json({
            totals: { scans: 0, massKg: 0, co2Kg: 0, valueINR: 0, gradeAPct: 0, hazardFlags: 0, activeOrgs: 0 },
            trend: [],
            topMaterials: [],
            generatedAt: new Date().toISOString(),
        });
    }
}
