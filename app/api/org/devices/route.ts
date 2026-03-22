import { NextRequest, NextResponse } from 'next/server';
import { requireUserProfile } from '@/lib/apiAuth';
import { listDevicesByOrg, registerDevice, getBatchStatus, type DeviceType } from '@/lib/deviceRegistry';

const ALLOWED_TYPES: DeviceType[] = ['esp32_gateway', 'raspberry_pi'];

export async function GET(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId) {
            return NextResponse.json({ error: 'User is not linked to an organization.' }, { status: 403 });
        }

        const devices = await listDevicesByOrg(profile.orgId);
        
        // Collect unique batch IDs and get their status summaries
        const batchIds = new Set<string>();
        devices.forEach(d => {
            if (d.batchId) batchIds.add(d.batchId);
        });
        
        const batchSummaries: Record<string, any> = {};
        for (const batchId of batchIds) {
            try {
                const summary = await getBatchStatus(batchId);
                batchSummaries[batchId] = summary;
            } catch (err) {
                console.warn(`[org/devices] Could not fetch batch status for ${batchId}:`, err);
            }
        }
        
        return NextResponse.json({ 
            devices,
            batchSummaries,
        });
    } catch (err) {
        const message = String(err);
        if (message.includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
        }
        console.error('[org/devices][GET] failed:', err);
        return NextResponse.json({ error: 'Failed to load devices.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId || profile.role !== 'org_admin') {
            return NextResponse.json({ error: 'Only org admins can register devices.' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const deviceId = String(body?.deviceId ?? '').trim().toLowerCase();
        const displayName = String(body?.displayName ?? '').trim();
        const deviceType = String(body?.deviceType ?? '') as DeviceType;

        if (!deviceId) return NextResponse.json({ error: 'deviceId is required.' }, { status: 400 });
        if (!displayName) return NextResponse.json({ error: 'displayName is required.' }, { status: 400 });
        if (!ALLOWED_TYPES.includes(deviceType)) {
            return NextResponse.json({ error: 'Invalid deviceType.' }, { status: 400 });
        }

        const { device, token } = await registerDevice({
            orgId: profile.orgId,
            deviceId,
            displayName,
            deviceType,
        });

        return NextResponse.json({
            success: true,
            device,
            deviceToken: token,
            note: 'Store this token on the hardware now. It is shown only once.',
        });
    } catch (err) {
        const message = String(err);
        if (message.includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
        }
        if (message.includes('DEVICE_ID_ALREADY_EXISTS')) {
            return NextResponse.json({ error: 'DEVICE_ID already exists.' }, { status: 409 });
        }
        console.error('[org/devices][POST] failed:', err);
        return NextResponse.json({ error: 'Failed to register device.' }, { status: 500 });
    }
}
