import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import { requireUserProfile } from '@/lib/apiAuth';

// GET — returns all org devices with their last known location + latest fill level
export async function GET(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId) {
            return NextResponse.json({ error: 'Not linked to an org' }, { status: 403 });
        }

        initializeAdmin();
        const db = getFirestore();

        // Get all org devices
        const devicesSnap = await db
            .collection('devices')
            .where('orgId', '==', profile.orgId)
            .where('status', '==', 'active')
            .get();

        // Get latest sensor readings (up to 100)
        const sensorSnap = await db
            .collection('sensor_readings')
            .where('orgId', '==', profile.orgId)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        // Build fill level map: deviceId → latest reading
        const latestFill: Record<string, {
            fillPct: number;
            temperature?: number;
            humidity?: number;
            lastSeen: string;
        }> = {};
        for (const doc of sensorSnap.docs) {
            const d = doc.data();
            const id = d.deviceId as string;
            if (!latestFill[id]) {
                latestFill[id] = {
                    fillPct: d.fillPercentage ?? d.fill_pct ?? 0,
                    temperature: d.temperature,
                    humidity: d.humidity,
                    lastSeen: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
                };
            }
        }

        const bins = devicesSnap.docs.map(doc => {
            const d = doc.data();
            const fill = latestFill[doc.id] ?? { fillPct: 0, lastSeen: new Date().toISOString() };
            return {
                deviceId: doc.id,
                displayName: d.displayName ?? doc.id,
                latitude: d.latitude ?? null,
                longitude: d.longitude ?? null,
                fillPct: fill.fillPct,
                temperature: fill.temperature ?? null,
                humidity: fill.humidity ?? null,
                lastSeen: fill.lastSeen,
                urgent: fill.fillPct >= 70,
            };
        }).sort((a, b) => b.fillPct - a.fillPct); // most full first

        return NextResponse.json({ bins });
    } catch (err) {
        if (String(err).includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('[devices/locations] error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH — save lat/lng for a single device
export async function PATCH(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId) {
            return NextResponse.json({ error: 'Not linked to an org' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const { deviceId, latitude, longitude } = body;

        if (!deviceId || latitude == null || longitude == null) {
            return NextResponse.json({ error: 'deviceId, latitude and longitude are required' }, { status: 400 });
        }

        initializeAdmin();
        const db = getFirestore();
        const ref = db.collection('devices').doc(deviceId as string);
        const snap = await ref.get();

        if (!snap.exists || snap.data()?.orgId !== profile.orgId) {
            return NextResponse.json({ error: 'Device not found or not yours' }, { status: 404 });
        }

        await ref.update({ latitude, longitude, updatedAt: new Date() });
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (String(err).includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('[devices/locations PATCH] error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
