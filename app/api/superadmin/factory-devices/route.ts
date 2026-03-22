import { NextRequest, NextResponse } from 'next/server';
import { requireUserProfile } from '@/lib/apiAuth';
import { createFactoryDevice, type DeviceType } from '@/lib/deviceRegistry';

const ALLOWED_TYPES: DeviceType[] = ['esp32_gateway', 'raspberry_pi'];

// ────────────────────────────────────────────────────────────────────────────
// POST /api/superadmin/factory-devices
// Superadmin-only endpoint to pre-register factory hardware and issue bootstrap token.
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (profile.role !== 'superadmin') {
            return NextResponse.json({ error: 'Only superadmin can create factory devices.' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const deviceId = String(body?.deviceId ?? '').trim().toLowerCase();
        const displayName = String(body?.displayName ?? '').trim();
        const deviceType = String(body?.deviceType ?? '') as DeviceType;
        const batchId = String(body?.batchId ?? '').trim() || undefined;

        if (!deviceId) return NextResponse.json({ error: 'deviceId is required.' }, { status: 400 });
        if (!displayName) return NextResponse.json({ error: 'displayName is required.' }, { status: 400 });
        if (!ALLOWED_TYPES.includes(deviceType)) {
            return NextResponse.json({ error: 'Invalid deviceType.' }, { status: 400 });
        }

        const result = await createFactoryDevice({
            deviceId,
            displayName,
            deviceType,
            batchId,
        });

        return NextResponse.json({
            success: true,
            device: result.device,
            bootstrapToken: result.bootstrapToken,
            note: 'Program this bootstrapToken into DEVICE_TOKEN_BOOTSTRAP in firmware.',
        });
    } catch (err) {
        const message = String(err);
        if (message.includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
        }
        if (message.includes('DEVICE_ID_ALREADY_EXISTS')) {
            return NextResponse.json({ error: 'DEVICE_ID already exists.' }, { status: 409 });
        }
        console.error('[superadmin/factory-devices][POST] failed:', err);
        return NextResponse.json({ error: 'Failed to create factory device.' }, { status: 500 });
    }
}
