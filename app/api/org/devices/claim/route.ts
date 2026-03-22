import { NextRequest, NextResponse } from 'next/server';
import { requireUserProfile } from '@/lib/apiAuth';
import { initiateDeviceClaim, getBatchStatus } from '@/lib/deviceRegistry';

// ────────────────────────────────────────────────────────────────────────────
// POST /api/org/devices/claim
// Org admin initiates a claim request for a factory device.
// Returns claim nonce for device to use in claim-verify challenge.
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const profile = await requireUserProfile(req);
        if (!profile.orgId || profile.role !== 'org_admin') {
            return NextResponse.json(
                { error: 'Only org admins can claim devices.' },
                { status: 403 },
            );
        }

        const body = await req.json().catch(() => ({}));
        const deviceId = String(body?.deviceId ?? '').trim();
        const displayName = String(body?.displayName ?? '').trim();

        if (!deviceId) {
            return NextResponse.json(
                { error: 'deviceId is required.' },
                { status: 400 },
            );
        }
        if (!displayName) {
            return NextResponse.json(
                { error: 'displayName is required.' },
                { status: 400 },
            );
        }

        const result = await initiateDeviceClaim(profile.orgId, deviceId, displayName);

        // Try to get batch status for feedback
        let batchStatus = null;
        try {
            const batchId = deviceId.toLowerCase().split('-unit-')[0];
            if (batchId) {
                batchStatus = await getBatchStatus(batchId);
            }
        } catch (err) {
            console.warn('[claim] Could not fetch batch status:', err);
        }

        return NextResponse.json({
            success: true,
            deviceId: result.deviceId,
            claimNonce: result.claimNonce,
            nonceExpiry: result.nonceExpiry,
            message: 'Claim initiated. Device must prove possession via claim-verify within 10 minutes.',
            batchStatus: batchStatus ? {
                batchId: batchStatus.batchId,
                totalDevices: batchStatus.statuses.total,
                claimedCount: batchStatus.statuses.claim_confirmed + batchStatus.statuses.active,
                pendingCount: batchStatus.statuses.factory_pending + batchStatus.statuses.claim_pending,
            } : null,
        });
    } catch (err) {
        const message = String(err);
        if (message.includes('MISSING_BEARER')) {
            return NextResponse.json(
                { error: 'Missing authorization token.' },
                { status: 401 },
            );
        }
        if (message.includes('DEVICE_NOT_FOUND')) {
            return NextResponse.json(
                { error: 'Device ID not found in factory inventory.' },
                { status: 404 },
            );
        }
        if (message.includes('DEVICE_ALREADY_CLAIMED')) {
            return NextResponse.json(
                { error: 'Device is already claimed by another organization.' },
                { status: 409 },
            );
        }
        if (message.includes('DEVICE_NOT_AVAILABLE_FOR_CLAIM')) {
            return NextResponse.json(
                { error: 'Device is not in factory_pending state and cannot be claimed.' },
                { status: 400 },
            );
        }
        console.error('[org/devices/claim] failed:', err);
        return NextResponse.json(
            { error: 'Failed to initiate claim.' },
            { status: 500 },
        );
    }
}
