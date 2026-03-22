import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';

export type DeviceType = 'esp32_gateway' | 'raspberry_pi';
export type DeviceStatus = 'factory_pending' | 'claim_pending' | 'claim_verified' | 'claim_confirmed' | 'active' | 'inactive';

export interface DeviceRecord {
    deviceId: string;
    orgId: string | null;
    displayName: string;
    deviceType: DeviceType;
    status: DeviceStatus;
    tokenHash: string;
    factoryBootstrapToken?: string;
    pendingRuntimeToken?: string | null;
    batchId?: string;
    claimNonce?: string;
    claimNonceExpiry?: Date | null;
    claimRequestedAt?: Date | null;
    claimVerifiedAt?: Date | null;
    claimConfirmedAt?: Date | null;
    wifiProvisionedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lastSeenAt: Date | null;
}

type RegisterDeviceInput = {
    orgId: string;
    deviceId: string;
    displayName: string;
    deviceType: DeviceType;
};

type CreateFactoryInventoryInput = {
    deviceId: string;
    displayName: string;
    deviceType: DeviceType;
    batchId?: string;
};

type ClaimDeviceInput = {
    orgId: string;
    deviceId: string;
    displayName: string;
};

type VerifyResult =
    | { ok: true; device: DeviceRecord }
    | { ok: false; reason: 'not_found' | 'inactive' | 'invalid_token' };

function canonicalDeviceId(value: string): string {
    return value.trim().toLowerCase();
}

function extractBatchId(deviceId: string): string | null {
    const canonical = canonicalDeviceId(deviceId);
    const parts = canonical.split('-unit-');
    if (parts.length === 2) {
        return parts[0];
    }
    return null;
}

function hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeHashCompare(expectedHash: string, incomingToken: string): boolean {
    const left = Buffer.from(expectedHash, 'hex');
    const right = Buffer.from(hashToken(incomingToken), 'hex');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

function generateDeviceToken(): string {
    return randomBytes(24).toString('hex');
}

function generateClaimNonce(): string {
    return randomBytes(16).toString('hex');
}

function generateFactoryBootstrapToken(): string {
    return randomBytes(32).toString('hex');
}

function toDeviceRecord(raw: FirebaseFirestore.DocumentData): DeviceRecord {
    return {
        deviceId: raw.deviceId,
        orgId: raw.orgId ?? null,
        displayName: raw.displayName,
        deviceType: raw.deviceType,
        status: raw.status,
        tokenHash: raw.tokenHash,
        factoryBootstrapToken: raw.factoryBootstrapToken,
        pendingRuntimeToken: raw.pendingRuntimeToken ?? null,
        batchId: raw.batchId,
        claimNonce: raw.claimNonce,
        claimNonceExpiry: raw.claimNonceExpiry?.toDate?.() ?? null,
        claimRequestedAt: raw.claimRequestedAt?.toDate?.() ?? null,
        claimVerifiedAt: raw.claimVerifiedAt?.toDate?.() ?? null,
        claimConfirmedAt: raw.claimConfirmedAt?.toDate?.() ?? null,
        wifiProvisionedAt: raw.wifiProvisionedAt?.toDate?.() ?? null,
        createdAt: raw.createdAt?.toDate?.() ?? new Date(0),
        updatedAt: raw.updatedAt?.toDate?.() ?? new Date(0),
        lastSeenAt: raw.lastSeenAt?.toDate?.() ?? null,
    };
}

// ── Factory Inventory Management ──────────────────────────────────────────────

/**
 * Create a factory inventory device (unclaimed state).
 * Called during manufacturing/pre-shipment to register hardware in the system.
 */
export async function createFactoryDevice(input: CreateFactoryInventoryInput) {
    const db = getFirestore(initializeAdmin());
    const now = new Date();
    const deviceId = canonicalDeviceId(input.deviceId);
    const batchId = input.batchId || extractBatchId(deviceId);
    const bootstrapToken = generateFactoryBootstrapToken();
    const bootstrapTokenHash = hashToken(bootstrapToken);
    
    const ref = db.collection('devices').doc(deviceId);
    const existing = await ref.get();

    if (existing.exists) {
        throw new Error('DEVICE_ID_ALREADY_EXISTS');
    }

    await ref.set({
        deviceId,
        orgId: null,
        displayName: input.displayName.trim(),
        deviceType: input.deviceType,
        status: 'factory_pending',
        tokenHash: bootstrapTokenHash,
        factoryBootstrapToken: bootstrapToken,
        pendingRuntimeToken: null,
        batchId,
        claimNonce: null,
        claimNonceExpiry: null,
        claimRequestedAt: null,
        claimVerifiedAt: null,
        claimConfirmedAt: null,
        wifiProvisionedAt: null,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: null,
    });

    return {
        device: {
            deviceId,
            orgId: null,
            displayName: input.displayName.trim(),
            deviceType: input.deviceType,
            status: 'factory_pending' as const,
            batchId,
            createdAt: now,
            updatedAt: now,
            lastSeenAt: null,
        },
        bootstrapToken,
    };
}

// ── Claiming Workflow ─────────────────────────────────────────────────────────

/**
 * Initiate a claim request for an existing factory device.
 * Generates a nonce for claim verification challenge.
 */
export async function initiateDeviceClaim(orgId: string, deviceIdRaw: string, displayName: string) {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();

    if (!snap.exists) {
        throw new Error('DEVICE_NOT_FOUND');
    }

    const data = snap.data() as DeviceRecord;

    // If a previous claim exists but the nonce is expired, auto-reset it so it
    // can be re-claimed. This prevents devices getting permanently stuck.
    const now = new Date();
    const nonceExpired = data.claimNonceExpiry
        ? now > (data.claimNonceExpiry as unknown as Date)
        : false;
    if (data.orgId && data.status === 'claim_pending' && nonceExpired) {
        // Stale claim — reset to factory_pending automatically
        await ref.update({
            orgId: null,
            status: 'factory_pending',
            claimNonce: null,
            claimNonceExpiry: null,
            claimRequestedAt: null,
            updatedAt: now,
        });
        // Refresh data
        const freshSnap = await ref.get();
        Object.assign(data, freshSnap.data());
    }

    if (data.orgId && !(data.status === 'claim_pending' && nonceExpired)) {
        throw new Error('DEVICE_ALREADY_CLAIMED');
    }
    if (data.status !== 'factory_pending') {
        throw new Error('DEVICE_NOT_AVAILABLE_FOR_CLAIM');
    }

    const claimNonce = generateClaimNonce();
    const nonceExpiry = new Date(now.getTime() + 30 * 60_000); // 30 min window


    await ref.update({
        orgId,
        displayName: displayName.trim(),
        status: 'claim_pending',
        claimNonce,
        claimNonceExpiry: nonceExpiry,
        claimRequestedAt: now,
        updatedAt: now,
    });

    return {
        deviceId,
        claimNonce,
        nonceExpiry,
    };
}

/**
 * Verify device possession via claim verification challenge.
 * Called by device during first boot to prove possession.
 */
export async function verifyDeviceClaim(deviceIdRaw: string, nonce: string) {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();

    if (!snap.exists) return { ok: false as const, reason: 'DEVICE_NOT_FOUND' };
    const data = toDeviceRecord(snap.data()!);

    if (data.status !== 'claim_pending') {
        return { ok: false as const, reason: 'NOT_IN_CLAIM_PENDING_STATE' };
    }
    if (data.claimNonce !== nonce) {
        return { ok: false as const, reason: 'NONCE_MISMATCH' };
    }
    // data.claimNonceExpiry is now a proper JS Date (via toDeviceRecord)
    if (data.claimNonceExpiry && new Date() > data.claimNonceExpiry) {
        return { ok: false as const, reason: 'NONCE_EXPIRED' };
    }


    const now = new Date();
    await ref.update({
        status: 'claim_verified',
        claimVerifiedAt: now,
        updatedAt: now,
    });

    return { ok: true as const, verified: true };
}

/**
 * Confirm claim after verification is complete.
 * Org admin calls this after confirming device presence.
 * Issues runtime OAuth token for ongoing sensor posting.
 */
export async function confirmDeviceClaim(orgId: string, deviceIdRaw: string) {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();

    if (!snap.exists) throw new Error('DEVICE_NOT_FOUND');
    const data = snap.data() as DeviceRecord;

    if (data.orgId !== orgId) throw new Error('DEVICE_FORBIDDEN');
    if (data.status !== 'claim_verified') {
        throw new Error('DEVICE_NOT_VERIFIED_YET');
    }

    const runtimeToken = generateDeviceToken();
    const runtimeTokenHash = hashToken(runtimeToken);
    const now = new Date();

    await ref.update({
        status: 'claim_confirmed',
        tokenHash: runtimeTokenHash,
        pendingRuntimeToken: runtimeToken,
        claimConfirmedAt: now,
        claimNonce: null,
        claimNonceExpiry: null,
        updatedAt: now,
    });

    return {
        deviceId,
        runtimeToken,
    };
}

/**
 * Get batch status summary (count of devices by status for a given batch).
 */
export async function getBatchStatus(batchId: string) {
    const db = getFirestore(initializeAdmin());
    const snap = await db
        .collection('devices')
        .where('batchId', '==', batchId)
        .get();

    const devices = snap.docs.map(d => toDeviceRecord(d.data()));
    const statuses = {
        total: devices.length,
        factory_pending: devices.filter(d => d.status === 'factory_pending').length,
        claim_pending: devices.filter(d => d.status === 'claim_pending').length,
        claim_verified: devices.filter(d => d.status === 'claim_verified').length,
        claim_confirmed: devices.filter(d => d.status === 'claim_confirmed').length,
        active: devices.filter(d => d.status === 'active').length,
        inactive: devices.filter(d => d.status === 'inactive').length,
    };

    return { batchId, devices, statuses };
}

export async function registerDevice(input: RegisterDeviceInput) {
    const db = getFirestore(initializeAdmin());
    const now = new Date();
    const deviceId = canonicalDeviceId(input.deviceId);
    const token = generateDeviceToken();
    const tokenHash = hashToken(token);
    const ref = db.collection('devices').doc(deviceId);
    const existing = await ref.get();

    if (existing.exists) {
        throw new Error('DEVICE_ID_ALREADY_EXISTS');
    }

    await ref.set({
        deviceId,
        orgId: input.orgId,
        displayName: input.displayName.trim(),
        deviceType: input.deviceType,
        status: 'active',
        tokenHash,
        batchId: extractBatchId(input.deviceId),
        createdAt: now,
        updatedAt: now,
        lastSeenAt: null,
    });

    return {
        device: {
            deviceId,
            orgId: input.orgId,
            displayName: input.displayName.trim(),
            deviceType: input.deviceType,
            status: 'active' as const,
            createdAt: now,
            updatedAt: now,
            lastSeenAt: null,
        },
        token,
    };
}

export async function listDevicesByOrg(orgId: string) {
    const db = getFirestore(initializeAdmin());
    let snap: FirebaseFirestore.QuerySnapshot;

    try {
        snap = await db
            .collection('devices')
            .where('orgId', '==', orgId)
            .orderBy('createdAt', 'desc')
            .get();
    } catch (err) {
        const msg = String(err).toLowerCase();
        const maybeCode = (err as { code?: unknown })?.code;
        const isMissingIndex =
            maybeCode === 9 ||
            msg.includes('failed-precondition') ||
            msg.includes('requires an index') ||
            msg.includes('missing index');

        if (!isMissingIndex) throw err;

        // Fallback path for environments where the composite index is not created yet.
        snap = await db
            .collection('devices')
            .where('orgId', '==', orgId)
            .get();
    }

    return snap.docs
        .map((d) => {
            const record = toDeviceRecord(d.data());
            const { tokenHash, ...safe } = record;
            return safe;
        })
        .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
}

export async function setDeviceStatus(orgId: string, deviceIdRaw: string, status: DeviceStatus) {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('DEVICE_NOT_FOUND');
    const current = snap.data() as DeviceRecord;
    if (current.orgId !== orgId) throw new Error('DEVICE_FORBIDDEN');

    await ref.update({ status, updatedAt: new Date() });
}

export async function rotateDeviceToken(orgId: string, deviceIdRaw: string) {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('DEVICE_NOT_FOUND');
    const current = snap.data() as DeviceRecord;
    if (current.orgId !== orgId) throw new Error('DEVICE_FORBIDDEN');

    const token = generateDeviceToken();
    await ref.update({
        tokenHash: hashToken(token),
        updatedAt: new Date(),
    });
    return token;
}

export async function verifyDeviceToken(deviceIdRaw: string, token: string): Promise<VerifyResult> {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const snap = await db.collection('devices').doc(deviceId).get();
    if (!snap.exists) return { ok: false, reason: 'not_found' };
    const data = snap.data();
    if (!data) return { ok: false, reason: 'not_found' };

    const record = toDeviceRecord(data);
    if (record.status !== 'active' && record.status !== 'claim_confirmed') {
        return { ok: false, reason: 'inactive' };
    }
    if (!safeHashCompare(record.tokenHash, token)) return { ok: false, reason: 'invalid_token' };

    return { ok: true, device: record };
}

type BootstrapStatusResult =
    | { ok: true; device: DeviceRecord }
    | { ok: false; reason: 'not_found' | 'invalid_bootstrap_token' };

export async function verifyFactoryBootstrapToken(deviceIdRaw: string, bootstrapToken: string): Promise<BootstrapStatusResult> {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const snap = await db.collection('devices').doc(deviceId).get();
    if (!snap.exists) return { ok: false, reason: 'not_found' };
    const data = snap.data();
    if (!data) return { ok: false, reason: 'not_found' };

    const record = toDeviceRecord(data);
    if (!record.factoryBootstrapToken || record.factoryBootstrapToken !== bootstrapToken) {
        return { ok: false, reason: 'invalid_bootstrap_token' };
    }

    return { ok: true, device: record };
}

export async function consumePendingRuntimeToken(deviceIdRaw: string): Promise<string | null> {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const raw = snap.data();
    if (!raw) return null;

    const data = toDeviceRecord(raw);
    const token = data.pendingRuntimeToken ?? null;
    if (!token) return null;

    await ref.update({
        pendingRuntimeToken: null,
        updatedAt: new Date(),
    });

    return token;
}

export async function finalizeFactoryBootstrap(deviceIdRaw: string) {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();

    if (!snap.exists) {
        throw new Error('DEVICE_NOT_FOUND');
    }

    const raw = snap.data();
    if (!raw) {
        throw new Error('DEVICE_NOT_FOUND');
    }

    const record = toDeviceRecord(raw);
    if (record.status !== 'claim_confirmed' && record.status !== 'active') {
        throw new Error('DEVICE_NOT_READY_FOR_FINALIZE');
    }

    const token = record.pendingRuntimeToken ?? null;
    if (!token) {
        if (record.status === 'active') {
            return {
                device: record,
                deviceToken: null,
                alreadyFinalized: true,
            };
        }
        throw new Error('PENDING_RUNTIME_TOKEN_MISSING');
    }

    const now = new Date();
    await ref.update({
        status: 'active',
        pendingRuntimeToken: null,
        updatedAt: now,
    });

    return {
        device: {
            ...record,
            status: 'active' as const,
            pendingRuntimeToken: null,
            updatedAt: now,
        },
        deviceToken: token,
        alreadyFinalized: false,
    };
}

export async function touchDeviceLastSeen(deviceIdRaw: string) {
    const db = getFirestore(initializeAdmin());
    const deviceId = canonicalDeviceId(deviceIdRaw);
    await db.collection('devices').doc(deviceId).update({
        lastSeenAt: new Date(),
        updatedAt: new Date(),
    });
}
