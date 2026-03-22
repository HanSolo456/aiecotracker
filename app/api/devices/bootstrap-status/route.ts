import { NextRequest, NextResponse } from 'next/server';
import { verifyFactoryBootstrapToken } from '@/lib/deviceRegistry';

// ────────────────────────────────────────────────────────────────────────────
// GET /api/devices/bootstrap-status
// Device polls this endpoint during first boot provisioning.
// Auth: x-device-id + x-device-bootstrap-token
// Returns claim state and nonce when available.
// ────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
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

        const device = verification.device;
        const claimConfirmedNextStep =
            device.deviceType === 'raspberry_pi'
                ? '/api/devices/bootstrap-finalize'
                : '/api/devices/provision-wifi';

        return NextResponse.json({
            success: true,
            deviceId: device.deviceId,
            deviceType: device.deviceType,
            status: device.status,
            claimNonce: device.claimNonce ?? null,
            claimNonceExpiry: device.claimNonceExpiry ?? null,
            claimRequestedAt: device.claimRequestedAt ?? null,
            claimVerifiedAt: device.claimVerifiedAt ?? null,
            claimConfirmedAt: device.claimConfirmedAt ?? null,
            wifiProvisionedAt: device.wifiProvisionedAt ?? null,
            nextStep:
                device.status === 'claim_pending'
                    ? '/api/devices/claim-verify'
                    : device.status === 'claim_confirmed'
                        ? claimConfirmedNextStep
                        : null,
            message: {
                factory_pending: 'Awaiting org admin claim initiation.',
                claim_pending: 'Claim initiated. Use claimNonce for /api/devices/claim-verify.',
                claim_verified: 'Device verified. Awaiting org admin claim confirmation.',
                claim_confirmed:
                    device.deviceType === 'raspberry_pi'
                        ? 'Claim confirmed. Fetch the runtime token via /api/devices/bootstrap-finalize.'
                        : 'Claim confirmed. Fetch WiFi via /api/devices/provision-wifi.',
                active: 'Device active.',
                inactive: 'Device inactive.',
            }[device.status] || 'Unknown state.',
        });
    } catch (err) {
        console.error('[devices/bootstrap-status] Error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
