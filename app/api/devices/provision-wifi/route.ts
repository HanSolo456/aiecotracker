import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import { decryptWiFiCredentials } from '@/lib/wifiCrypto';
import {
    verifyDeviceToken,
    verifyFactoryBootstrapToken,
    consumePendingRuntimeToken,
    type DeviceRecord,
} from '@/lib/deviceRegistry';

// ────────────────────────────────────────────────────────────────────────────
// POST /api/devices/provision-wifi
// Device calls this once after claim confirmation to fetch org WiFi credentials.
// Requires: x-device-id (header), x-device-token (header)
// Returns: { ssid, password } only on first provisioning.
// Subsequent calls will fail to prevent plaintext WiFi exposure.
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const deviceId = req.headers.get('x-device-id');
        const deviceToken = req.headers.get('x-device-token');
        const bootstrapToken = req.headers.get('x-device-bootstrap-token');

        if (!deviceId || (!deviceToken && !bootstrapToken)) {
            return NextResponse.json(
                { error: 'x-device-id and either x-device-token or x-device-bootstrap-token headers required.' },
                { status: 400 },
            );
        }

        // Verify via runtime token (post-claim) or factory bootstrap token (first-boot flow)
        let device: DeviceRecord | null = null;
        let usingBootstrapToken = false;
        if (deviceToken) {
            const verification = await verifyDeviceToken(deviceId, deviceToken);
            if (verification.ok) {
                device = verification.device;
            }
        }

        if (!device && bootstrapToken) {
            const bootstrapVerification = await verifyFactoryBootstrapToken(deviceId, bootstrapToken);
            if (bootstrapVerification.ok) {
                device = bootstrapVerification.device;
                usingBootstrapToken = true;
            }
        }

        if (!device) {
            return NextResponse.json(
                { error: 'Device auth failed.' },
                { status: 401 },
            );
        }

        // Only allow WiFi provisioning for claim_confirmed devices
        if (device.status !== 'claim_confirmed') {
            return NextResponse.json(
                {
                    error: 'Device not ready for WiFi provisioning.',
                    currentStatus: device.status,
                },
                { status: 400 },
            );
        }

        // Prevent re-fetch: if wifiProvisionedAt is set, deny the request
        if (device.wifiProvisionedAt) {
            return NextResponse.json(
                { error: 'WiFi provisioning already completed for this device.' },
                { status: 403 },
            );
        }

        // Fetch org settings
        const db = getFirestore(initializeAdmin());
        const orgSnap = await db.collection('orgs').doc(device.orgId!).get();
        if (!orgSnap.exists) {
            return NextResponse.json(
                { error: 'Organization not found.' },
                { status: 404 },
            );
        }

        const orgData = orgSnap.data() as { wifiSsid?: string; wifiPasswordEncrypted?: string };

        if (!orgData.wifiSsid || !orgData.wifiPasswordEncrypted) {
            return NextResponse.json(
                {
                    error: 'Organization WiFi credentials not configured.',
                    message: 'Admin must set WiFi SSID and password in organization settings.',
                },
                { status: 500 },
            );
        }

        // Decrypt WiFi credentials
        let decrypted;
        try {
            decrypted = decryptWiFiCredentials({
                encrypted: orgData.wifiPasswordEncrypted,
                algorithm: 'aes-256-gcm',
            });
        } catch (err) {
            console.error('[provision-wifi] decryption failed:', err);
            return NextResponse.json(
                { error: 'Failed to decrypt WiFi credentials.' },
                { status: 500 },
            );
        }

        // Mark WiFi as provisioned
        const devicesRef = db.collection('devices').doc(deviceId.toLowerCase());
        await devicesRef.update({
            wifiProvisionedAt: new Date(),
            status: 'active',
            updatedAt: new Date(),
        });

        // First-boot bootstrap flow can receive runtime token once.
        let runtimeToken: string | null = null;
        if (usingBootstrapToken) {
            runtimeToken = await consumePendingRuntimeToken(deviceId);
        }

        // Return WiFi credentials only once
        return NextResponse.json({
            success: true,
            ssid: orgData.wifiSsid,
            password: decrypted.password,
            deviceToken: runtimeToken,
            message: 'WiFi provisioning complete. Device should reboot onto org network.',
        });
    } catch (err) {
        console.error('[devices/provision-wifi] Error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
