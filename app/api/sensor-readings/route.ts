import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import { checkRateLimit } from '@/lib/requestRateLimit';
import { requireUserProfile } from '@/lib/apiAuth';

// GET /api/sensor-readings — returns latest org-scoped sensor readings for authenticated user
export async function GET(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId) {
            return NextResponse.json({ error: 'User is not linked to an organization.', readings: [] }, { status: 403 });
        }

        const rl = checkRateLimit(req, {
            keyPrefix: 'sensor-readings',
            keySuffix: profile.uid,
            limit: 30,
            windowMs: 60_000,
        });
        if (!rl.allowed) {
            return NextResponse.json({ readings: [] }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
        }

        initializeAdmin();
        const db = getFirestore();
        const snap = await db
            .collection('sensor_readings')
            .where('orgId', '==', profile.orgId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const readings = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        }));

        return NextResponse.json({ readings }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (err) {
        if (String(err).includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Missing authorization token.', readings: [] }, { status: 401 });
        }
        console.error('[sensor-readings] Error:', err);
        return NextResponse.json({ readings: [] }, { status: 200 });
    }
}
