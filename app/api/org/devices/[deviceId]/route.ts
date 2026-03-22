import { NextRequest, NextResponse } from 'next/server';
import { requireUserProfile } from '@/lib/apiAuth';
import { rotateDeviceToken, setDeviceStatus, confirmDeviceClaim } from '@/lib/deviceRegistry';

export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ deviceId: string }> },
) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId || profile.role !== 'org_admin') {
            return NextResponse.json({ error: 'Only org admins can manage devices.' }, { status: 403 });
        }

        const { deviceId } = await ctx.params;
        const body = await req.json().catch(() => ({}));
        const action = String(body?.action ?? '');

        if (action === 'activate') {
            await setDeviceStatus(profile.orgId, deviceId, 'active');
            return NextResponse.json({ success: true, status: 'active' });
        }

        if (action === 'deactivate') {
            await setDeviceStatus(profile.orgId, deviceId, 'inactive');
            return NextResponse.json({ success: true, status: 'inactive' });
        }

        if (action === 'rotate_token') {
            const newToken = await rotateDeviceToken(profile.orgId, deviceId);
            return NextResponse.json({
                success: true,
                deviceToken: newToken,
                note: 'Store this token on the hardware now. It is shown only once.',
            });
        }

        if (action === 'confirm_claim') {
            const { runtimeToken } = await confirmDeviceClaim(profile.orgId, deviceId);
            return NextResponse.json({
                success: true,
                status: 'claim_confirmed',
                deviceToken: runtimeToken,
                message: 'Claim confirmed. Device can now proceed with WiFi provisioning.',
            });
        }

        return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    } catch (err) {
        const message = String(err);
        if (message.includes('MISSING_BEARER')) {
            return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
        }
        if (message.includes('DEVICE_NOT_FOUND')) {
            return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
        }
        if (message.includes('DEVICE_FORBIDDEN')) {
            return NextResponse.json({ error: 'Device does not belong to your organization.' }, { status: 403 });
        }
        if (message.includes('DEVICE_NOT_VERIFIED_YET')) {
            return NextResponse.json(
                { error: 'Device has not completed claim verification yet. Please wait or retry.' },
                { status: 400 },
            );
        }
        console.error('[org/devices/:deviceId][PATCH] failed:', err);
        return NextResponse.json({ error: 'Failed to update device.' }, { status: 500 });
    }
}
