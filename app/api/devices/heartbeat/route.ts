import { NextRequest, NextResponse } from 'next/server';
import { verifyDeviceClaim } from '@/lib/deviceRegistry';

// ────────────────────────────────────────────────────────────────────────────
// POST /api/devices/heartbeat (DEPRECATED)
// DEPRECATED: Use /api/devices/claim-verify instead.
// Device calls this during first boot to prove possession and verify claim.
// No auth required for this step (device doesn't have token yet).
// Must provide deviceId and claimNonce from the claim initiation.
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const deviceId = String(body?.deviceId ?? '').trim();
        const nonce = String(body?.nonce ?? '').trim();

        if (!deviceId || !nonce) {
            return NextResponse.json(
                { error: 'deviceId and nonce are required.' },
                { status: 400 },
            );
        }

        const result = await verifyDeviceClaim(deviceId, nonce);

        if (!result.ok) {
            const statusMap: Record<string, number> = {
                DEVICE_NOT_FOUND: 404,
                NOT_IN_CLAIM_PENDING_STATE: 400,
                NONCE_MISMATCH: 401,
                NONCE_EXPIRED: 410,
            };
            
            return NextResponse.json(
                {
                    success: false,
                    error: result.reason,
                    message: {
                        DEVICE_NOT_FOUND: 'Device not found in inventory.',
                        NOT_IN_CLAIM_PENDING_STATE: 'Device is not awaiting claim verification.',
                        NONCE_MISMATCH: 'Nonce does not match. Claim may need to be re-initiated.',
                        NONCE_EXPIRED: 'Claim nonce has expired. Please re-initiate the claim.',
                    }[result.reason] || 'Verification failed.',
                },
                { status: statusMap[result.reason] || 400 },
            );
        }

        return NextResponse.json({
            success: true,
            verified: true,
            message: 'Device possession verified. Waiting for org admin confirmation.',
        });
    } catch (err) {
        console.error('[devices/heartbeat] Error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
