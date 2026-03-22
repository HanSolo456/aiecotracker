import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import { requireUserProfile } from '@/lib/apiAuth';

const USD_TO_INR = 83.5;

// CO₂ factors kg per kg material (EPA / IPCC estimates)
const CO2_FACTOR: Record<string, number> = {
    plastic:   2.53, metal:   1.46, aluminum: 9.16, pcb:   3.10,
    glass:     0.31, paper:   1.08, battery:  5.40, ewaste: 4.20,
    default:   2.50,
};

function normaliseMaterial(raw: string | undefined): string {
    if (!raw) return 'default';
    const s = raw.toLowerCase();
    if (s.includes('alum'))    return 'aluminum';
    if (s.includes('copper'))  return 'copper';
    if (s.includes('pcb') || s.includes('circuit')) return 'pcb';
    if (s.includes('plastic')) return 'plastic';
    if (s.includes('glass'))   return 'glass';
    if (s.includes('paper') || s.includes('cardboard')) return 'paper';
    if (s.includes('battery')) return 'battery';
    if (s.includes('metal') || s.includes('steel') || s.includes('iron')) return 'metal';
    if (s.includes('ewaste') || s.includes('electronic')) return 'ewaste';
    return 'default';
}

/**
 * Mirrors getScanRecoveryValueINR from lib/scanService.ts:
 * 1) use DPP total_theoretical_recovery_value_usd if present
 * 2) fall back to recoveryValueUSD × USD_TO_INR
 */
function getRecoveryValueINR(d: FirebaseFirestore.DocumentData): number {
    // Try DPP JSON
    if (d.dpp && d.dpp !== '{}' && d.dpp !== 'null') {
        try {
            const dpp = JSON.parse(d.dpp as string);
            const val = dpp?.material_composition?.total_theoretical_recovery_value_usd;
            if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
                return Math.round(val * 100) / 100; // stored value already in INR in current pipeline
            }
        } catch { /* ignore */ }
    }
    // Fallback: recoveryValueUSD × rate
    return Math.round(((d.recoveryValueUSD as number) ?? 0) * USD_TO_INR * 100) / 100;
}

export async function GET(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId) {
            return NextResponse.json({ error: 'Not linked to an org' }, { status: 403 });
        }

        initializeAdmin();
        const db = getFirestore();

        // Fetch org scans
        const scansSnap = await db
            .collection('scans')
            .where('orgId', '==', profile.orgId)
            .orderBy('createdAt', 'desc')
            .get();

        // Aggregate
        let totalMassKg    = 0;
        let totalCO2Kg     = 0;
        let totalValueINR  = 0;
        let gradeACount    = 0;
        let totalScans     = 0;
        const byMaterial: Record<string, { massKg: number; count: number }> = {};
        const byDay: Record<string, { massKg: number; co2Kg: number }> = {};

        for (const doc of scansSnap.docs) {
            const d = doc.data();
            const mat  = normaliseMaterial(d.material ?? d.itemCategory ?? d.itemType);
            const mass = d.estimatedMassKg ?? 0.5;
            const co2  = mass * (CO2_FACTOR[mat] ?? CO2_FACTOR.default);
            const val  = getRecoveryValueINR(d);
            const day  = d.createdAt?.toDate?.()?.toISOString().slice(0, 10) ?? '2024-01-01';

            totalMassKg   += mass;
            totalCO2Kg    += co2;
            totalValueINR += val;
            totalScans    += 1;
            if (d.grade === 'A') gradeACount++;

            byMaterial[mat] = byMaterial[mat] ?? { massKg: 0, count: 0 };
            byMaterial[mat].massKg += mass;
            byMaterial[mat].count  += 1;

            byDay[day] = byDay[day] ?? { massKg: 0, co2Kg: 0 };
            byDay[day].massKg += mass;
            byDay[day].co2Kg  += co2;
        }

        // Latest sensor readings for bin fill levels
        const sensorSnap = await db
            .collection('sensor_readings')
            .where('orgId', '==', profile.orgId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        // Deduplicate: take latest per device
        const latestByDevice: Record<string, { fillPct: number; deviceId: string }> = {};
        for (const doc of sensorSnap.docs) {
            const d = doc.data();
            if (!latestByDevice[d.deviceId]) {
                latestByDevice[d.deviceId] = {
                    deviceId: d.deviceId,
                    fillPct: d.fillPercentage ?? d.fill_pct ?? 0,
                };
            }
        }
        const bins = Object.values(latestByDevice);
        const avgFillPct = bins.length
            ? Math.round(bins.reduce((s, b) => s + b.fillPct, 0) / bins.length)
            : 0;

        // Build trend: last 30 days sorted
        const trendDays = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-30)
            .map(([date, v]) => ({ date, massKg: +v.massKg.toFixed(2), co2Kg: +v.co2Kg.toFixed(2) }));

        // Material breakdown sorted by mass
        const materialBreakdown = Object.entries(byMaterial)
            .map(([material, v]) => ({
                material,
                massKg: +v.massKg.toFixed(2),
                count: v.count,
                co2Kg: +(v.massKg * (CO2_FACTOR[material] ?? CO2_FACTOR.default)).toFixed(2),
            }))
            .sort((a, b) => b.massKg - a.massKg);

        return NextResponse.json({
            summary: {
                totalScans,
                totalMassKg:    +totalMassKg.toFixed(1),
                totalCO2Kg:     +totalCO2Kg.toFixed(1),
                totalValueINR:  Math.round(totalValueINR),
                segregationPct: totalScans > 0 ? Math.round((gradeACount / totalScans) * 100) : 0,
                avgBinFillPct:  avgFillPct,
                activeBins:     bins.length,
            },
            materialBreakdown,
            trend: trendDays,
        });
    } catch (err) {
        if (String(err).includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('[org/impact] error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
