import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import { encryptWiFiCredentials, decryptWiFiCredentials } from '@/lib/wifiCrypto';
import { requireUserProfile } from '@/lib/apiAuth';

// ────────────────────────────────────────────────────────────────────────────
// Organization WiFi Settings Endpoints
// POST:   Set WiFi SSID and password (encrypted server-side)
// GET:    Masked read of WiFi settings (SSID visible, password hidden)
// PATCH:  Update WiFi settings
// DELETE: Clear WiFi settings
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        let profile;
        try {
            profile = await requireUserProfile(req);
        } catch (err) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orgId, ssid, password } = await req.json();
        if (!orgId) {
            return NextResponse.json({ error: 'orgId required' }, { status: 400 });
        }

        // Verify user is org admin
        if (!profile.orgId || profile.role !== 'org_admin') {
            return NextResponse.json(
                { error: 'Only org admins can set WiFi settings' },
                { status: 403 },
            );
        }

        const db = getFirestore(initializeAdmin());
        const orgSnap = await db.collection('orgs').doc(orgId).get();
        if (!orgSnap.exists) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Double check they're admin of THIS org
        if (profile.orgId !== orgId) {
            return NextResponse.json(
                { error: 'You can only manage your own organization' },
                { status: 403 },
            );
        }

        if (!ssid || !password) {
            return NextResponse.json(
                { error: 'ssid and password required' },
                { status: 400 },
            );
        }

        if (ssid.length > 32) {
            return NextResponse.json(
                { error: 'SSID must be 32 characters or less' },
                { status: 400 },
            );
        }

        if (password.length < 8 || password.length > 63) {
            return NextResponse.json(
                { error: 'Password must be 8-63 characters' },
                { status: 400 },
            );
        }

        // Encrypt and store
        const encrypted = encryptWiFiCredentials(ssid, password);
        await db.collection('orgs').doc(orgId).update({
            wifiSsid: ssid,
            wifiPasswordEncrypted: encrypted.encrypted,
            wifiLastUpdatedAt: new Date(),
            wifiLastUpdatedBy: profile.uid,
        });

        return NextResponse.json({
            success: true,
            message: 'WiFi settings saved. Credentials encrypted server-side.',
            ssid: ssid, // echo back for confirmation
            updatedAt: new Date(),
        });
    } catch (err) {
        console.error('[org/wifi-settings POST] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        let profile;
        try {
            profile = await requireUserProfile(req);
        } catch (err) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = req.nextUrl.searchParams;
        const orgId = searchParams.get('orgId');
        if (!orgId) {
            return NextResponse.json({ error: 'orgId query param required' }, { status: 400 });
        }

        // Verify user is org admin of this org
        if (!profile.orgId || profile.role !== 'org_admin' || profile.orgId !== orgId) {
            return NextResponse.json(
                { error: 'Only org admins can view WiFi settings' },
                { status: 403 },
            );
        }

        const db = getFirestore(initializeAdmin());
        const orgSnap = await db.collection('orgs').doc(orgId).get();
        if (!orgSnap.exists) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const orgData = orgSnap.data() as {
            wifiSsid?: string;
            wifiPasswordEncrypted?: string;
            wifiLastUpdatedAt?: any;
        };

        return NextResponse.json({
            success: true,
            configured: !!orgData.wifiSsid,
            ssid: orgData.wifiSsid || null,
            passwordMasked: orgData.wifiPasswordEncrypted ? '••••••••' : null,
            lastUpdatedAt: orgData.wifiLastUpdatedAt || null,
            message: 'Password is encrypted and never returned in plaintext.',
        });
    } catch (err) {
        console.error('[org/wifi-settings GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        let profile;
        try {
            profile = await requireUserProfile(req);
        } catch (err) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orgId, ssid, password } = await req.json();
        if (!orgId) {
            return NextResponse.json({ error: 'orgId required' }, { status: 400 });
        }

        if (!ssid && !password) {
            return NextResponse.json(
                { error: 'At least ssid or password required for update' },
                { status: 400 },
            );
        }

        // Verify user is org admin of this org
        if (!profile.orgId || profile.role !== 'org_admin' || profile.orgId !== orgId) {
            return NextResponse.json(
                { error: 'Only org admins can update WiFi settings' },
                { status: 403 },
            );
        }

        const db = getFirestore(initializeAdmin());
        const orgSnap = await db.collection('orgs').doc(orgId).get();
        if (!orgSnap.exists) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const orgData = orgSnap.data() as {
            wifiSsid?: string;
            wifiPasswordEncrypted?: string;
        };

        const newSsid = ssid || orgData.wifiSsid;
        const newPassword = password || undefined;

        if (!newSsid) {
            return NextResponse.json(
                { error: 'SSID must be provided (existing or new)' },
                { status: 400 },
            );
        }

        if (newSsid.length > 32) {
            return NextResponse.json(
                { error: 'SSID must be 32 characters or less' },
                { status: 400 },
            );
        }

        if (newPassword && (newPassword.length < 8 || newPassword.length > 63)) {
            return NextResponse.json(
                { error: 'Password must be 8-63 characters' },
                { status: 400 },
            );
        }

        // If only SSID is being updated, encrypt with existing password
        let encryptedPayload = orgData.wifiPasswordEncrypted;
        if (newPassword) {
            const encrypted = encryptWiFiCredentials(newSsid, newPassword);
            encryptedPayload = encrypted.encrypted;
        } else if (newSsid !== orgData.wifiSsid) {
            // SSID changed but password didn't - need to re-encrypt with new SSID
            // First decrypt old password
            if (!orgData.wifiPasswordEncrypted) {
                return NextResponse.json(
                    { error: 'Cannot update SSID without existing password. Set both.' },
                    { status: 400 },
                );
            }

            try {
                const decrypted = decryptWiFiCredentials({
                    encrypted: orgData.wifiPasswordEncrypted,
                    algorithm: 'aes-256-gcm',
                });
                const encrypted = encryptWiFiCredentials(newSsid, decrypted.password);
                encryptedPayload = encrypted.encrypted;
            } catch (err) {
                console.error('[wifi-settings PATCH] Decryption failed:', err);
                return NextResponse.json(
                    { error: 'Failed to update SSID. Contact support.' },
                    { status: 500 },
                );
            }
        }

        await db.collection('orgs').doc(orgId).update({
            wifiSsid: newSsid,
            wifiPasswordEncrypted: encryptedPayload,
            wifiLastUpdatedAt: new Date(),
            wifiLastUpdatedBy: profile.uid,
        });

        return NextResponse.json({
            success: true,
            message: 'WiFi settings updated.',
            ssid: newSsid,
            passwordUpdated: !!newPassword,
            updatedAt: new Date(),
        });
    } catch (err) {
        console.error('[org/wifi-settings PATCH] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        let profile;
        try {
            profile = await requireUserProfile(req);
        } catch (err) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orgId } = await req.json();
        if (!orgId) {
            return NextResponse.json({ error: 'orgId required' }, { status: 400 });
        }

        // Verify user is org admin of this org
        if (!profile.orgId || profile.role !== 'org_admin' || profile.orgId !== orgId) {
            return NextResponse.json(
                { error: 'Only org admins can delete WiFi settings' },
                { status: 403 },
            );
        }

        const db = getFirestore(initializeAdmin());
        const orgSnap = await db.collection('orgs').doc(orgId).get();
        if (!orgSnap.exists) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        await db.collection('orgs').doc(orgId).update({
            wifiSsid: null,
            wifiPasswordEncrypted: null,
            wifiLastUpdatedAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            message: 'WiFi settings cleared.',
        });
    } catch (err) {
        console.error('[org/wifi-settings DELETE] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
