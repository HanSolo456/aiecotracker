import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgType = 'recycler' | 'manufacturer' | 'collection_center';

export interface OrgProfile {
    orgId: string;
    name: string;
    type: OrgType;
    address: string;
    gstin?: string;
    contactEmail: string;
    adminUid: string;
    wifiSsid?: string;
    wifiPasswordEncrypted?: string;
    wifiLastUpdatedAt?: unknown;
    createdAt?: unknown;
}

export interface CreateOrgInput {
    name: string;
    type: OrgType;
    address: string;
    gstin?: string;
    contactEmail: string;
}

const ORG_CACHE_TTL_MS = 60_000;
const orgCache = new Map<string, { value: OrgProfile | null; ts: number }>();

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Creates a new org doc and links the admin user to it.
 * Sets the user's role to 'org_admin'.
 */
export async function createOrg(adminUid: string, data: CreateOrgInput): Promise<OrgProfile> {
    const orgRef = doc(collection(db, 'orgs'));
    const orgId = orgRef.id;

    const orgData: OrgProfile = {
        orgId,
        name: data.name,
        type: data.type,
        address: data.address,
        gstin: data.gstin ?? '',
        contactEmail: data.contactEmail,
        adminUid,
    };

    await setDoc(orgRef, { ...orgData, createdAt: serverTimestamp() });

    // Link user to org
    await updateDoc(doc(db, 'users', adminUid), {
        orgId,
        role: 'org_admin',
    });

    orgCache.set(orgId, { value: orgData, ts: Date.now() });

    return orgData;
}

/**
 * Fetches an org document by ID.
 */
export async function getOrg(orgId: string): Promise<OrgProfile | null> {
    const cached = orgCache.get(orgId);
    if (cached && Date.now() - cached.ts < ORG_CACHE_TTL_MS) {
        return cached.value;
    }

    const snap = await getDoc(doc(db, 'orgs', orgId));
    if (!snap.exists()) return null;
    const value = snap.data() as OrgProfile;
    orgCache.set(orgId, { value, ts: Date.now() });
    return value;
}

/**
 * Partially updates an org document.
 */
export async function updateOrg(orgId: string, data: Partial<CreateOrgInput>): Promise<void> {
    await updateDoc(doc(db, 'orgs', orgId), data);
    const cached = orgCache.get(orgId);
    if (cached?.value) {
        orgCache.set(orgId, {
            value: { ...cached.value, ...data },
            ts: Date.now(),
        });
    }
}
