import { NextRequest, NextResponse } from 'next/server';
import { finalizeFactoryBootstrap, verifyFactoryBootstrapToken } from '@/lib/deviceRegistry';

// ────────────────────────────────────────────────────────────────────────────
// POST /api/devices/bootstrap-finalize
// Raspberry Pi calls this after claim confirmation to exchange its factory
// bootstrap token for the runtime device token. Unlike ESP32, no Wi-Fi
// credentials are returned here.
// Auth: x-device-id + x-device-bootstrap-token
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const deviceId = String(req.headers.get('x-device-id') ?? '').trim();
        const bootstrapToken = String(req.headers.get('x-device-bootstrap-token') ?? '').trim();

        if (!deviceId || !bootstrapToken) {
            return NextResponse.json(
                { error: 'x-device-id and x-device-bootstrap-token headers required.' },
                { status: 400 },
            );
        }

        const verification = await verifyFactoryBootstrapToken(deviceId, bootstrapToken);
        if (!verification.ok) {
            const status = verification.reason === 'not_found' ? 404 : 401;
            return NextResponse.json(
                { error: `Bootstrap auth failed: ${verification.reason}` },
                { status },
            );
        }

        if (verification.device.deviceType !== 'raspberry_pi') {
            return NextResponse.json(
                {
                    error: 'This endpoint is only for Raspberry Pi devices.',
                    deviceType: verification.device.deviceType,
                    suggestedEndpoint: '/api/devices/provision-wifi',
                },
                { status: 400 },
            );
        }

        const finalized = await finalizeFactoryBootstrap(deviceId);

        return NextResponse.json({
            success: true,
            deviceId: finalized.device.deviceId,
            deviceType: finalized.device.deviceType,
            orgId: finalized.device.orgId,
            displayName: finalized.device.displayName,
            status: finalized.device.status,
            deviceToken: finalized.deviceToken,
            alreadyFinalized: finalized.alreadyFinalized,
            stationPath: `/org/stations/${finalized.device.deviceId}`,
            message: finalized.alreadyFinalized
                ? 'Bootstrap finalization was already completed. Use the stored runtime token on the device.'
                : 'Bootstrap finalization complete. Persist the runtime token on the Raspberry Pi now.',
        });
    } catch (err) {
        const message = String(err);
        if (message.includes('DEVICE_NOT_FOUND')) {
            return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
        }
        if (message.includes('DEVICE_NOT_READY_FOR_FINALIZE')) {
            return NextResponse.json(
                { error: 'Device is not ready for bootstrap finalization yet.' },
                { status: 400 },
            );
        }
        if (message.includes('PENDING_RUNTIME_TOKEN_MISSING')) {
            return NextResponse.json(
                { error: 'Pending runtime token missing for this device.' },
                { status: 409 },
            );
        }
        console.error('[devices/bootstrap-finalize] Error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
