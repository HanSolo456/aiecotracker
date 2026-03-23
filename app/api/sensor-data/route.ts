import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import { checkRateLimit } from '@/lib/requestRateLimit';
import { touchDeviceLastSeen, verifyDeviceToken } from '@/lib/deviceRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sensor-data
//
// ESP-32 Gateway endpoint — receives live sensor readings from the hardware bin
// and saves them to Firestore 'sensor_readings' collection.
//
// Headers: { x-device-token: string }
// Body: {
//   device_id:    string
//   fill_level:   number  (0-100 %)
//   gas_ppm:      number  (MQ-135 raw ADC)
//   co_ppm:       number  (MQ-7 raw ADC)
//   temperature:  number  (°C)
//   humidity:     number  (%)
//   item_dropped: boolean
//   gas_alert:    boolean
// }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const deviceToken = req.headers.get('x-device-token');

        const {
            device_id = '',
            fill_level = 0,
            gas_ppm = 0,
            co_ppm = 0,
            temperature = 0,
            humidity = 0,
            item_dropped = false,
            gas_alert = false,
        } = body;

        if (!deviceToken) {
            return NextResponse.json({ success: false, error: 'Missing x-device-token header' }, { status: 401 });
        }

        if (typeof device_id !== 'string' || !device_id.trim()) {
            return NextResponse.json({ success: false, error: 'device_id is required' }, { status: 400 });
        }

        const verification = await verifyDeviceToken(device_id, deviceToken);
        if (!verification.ok) {
            const map: Record<typeof verification.reason, number> = {
                not_found: 404,
                inactive: 403,
                invalid_token: 401,
            };
            return NextResponse.json(
                { success: false, error: `Device auth failed: ${verification.reason}` },
                { status: map[verification.reason] },
            );
        }

        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'sensor-data',
            keySuffix: verification.device.deviceId,
            limit: 120,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } },
            );
        }

        // ── Derive alert level ────────────────────────────────────────────────────
        const alertLevel =
            gas_alert ? 'danger' :
                gas_ppm > 300 ? 'warning' :
                    fill_level > 80 ? 'warning' :
                        'normal';

        const record = {
            createdAt: new Date(),
            orgId: verification.device.orgId,
            deviceId: verification.device.deviceId,
            wasteCategory: verification.device.wasteCategory ?? 'recyclable',
            fillLevel: fill_level,
            gasPpm: gas_ppm,
            coPpm: co_ppm,
            temperature,
            humidity,
            itemDropped: item_dropped,
            gasAlert: gas_alert,
            alertLevel,
            source: 'esp32_gateway',
        };

        // ── Save to Firestore ─────────────────────────────────────────────────────
        let readingId: string | null = null;
        try {
            initializeAdmin();
            const db = getFirestore();
            const ref = await db.collection('sensor_readings').add(record);
            readingId = ref.id;
            await touchDeviceLastSeen(verification.device.deviceId);
            console.log(`[sensor-data] Saved reading ${readingId} from ${verification.device.deviceId}`);
        } catch (err) {
            console.warn('[sensor-data] Firestore write failed (non-fatal):', err);
        }

        return NextResponse.json({
            success: true,
            reading_id: readingId,
            device_id: verification.device.deviceId,
            org_id: verification.device.orgId,
            alert_level: alertLevel,
            summary: {
                fill_level,
                gas_ppm,
                temperature,
                item_dropped,
            },
        });

    } catch (err) {
        console.error('[sensor-data] Error:', err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
