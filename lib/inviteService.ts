import {
    doc, setDoc, getDoc, updateDoc, serverTimestamp, collection,
    type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Invite {
    code: string;
    orgId: string;
    orgName: string;
    createdBy: string;          // uid of admin who created invite
    usedBy?: string;            // uid of worker who redeemed
    usedAt?: Timestamp;
    expiresAt: Timestamp;
    createdAt: Timestamp;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomCode(len = 8): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let result = '';
    for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Generates a new invite code for an org. Expires in 7 days.
 * Returns the invite code string.
 */
export async function generateInvite(orgId: string, orgName: string, createdBy: string): Promise<string> {
    const code = randomCode(8);
    const now = Date.now();
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000); // +7 days

    await setDoc(doc(collection(db, 'invites'), code), {
        code,
        orgId,
        orgName,
        createdBy,
        expiresAt,
        createdAt: serverTimestamp(),
    });

    return code;
}

/**
 * Reads an invite doc. Returns null if not found.
 */
export async function getInvite(code: string): Promise<Invite | null> {
    const snap = await getDoc(doc(db, 'invites', code));
    if (!snap.exists()) return null;
    return snap.data() as Invite;
}

/**
 * Redeems an invite for a given user.
 * Validates: invite exists, not already used, not expired.
 * Sets user's orgId + role to 'worker'.
 */
export async function redeemInvite(code: string, uid: string): Promise<{ orgId: string; orgName: string }> {
    const invite = await getInvite(code);

    if (!invite) throw new Error('invite-not-found');

    const now = new Date();
    const expiresAt = (invite.expiresAt as unknown as { toDate: () => Date }).toDate?.() ?? new Date(0);
    if (now > expiresAt) throw new Error('invite-expired');
    if (invite.usedBy) throw new Error('invite-already-used');

    // Mark invite as used
    await setDoc(doc(db, 'invites', code), {
        usedBy: uid,
        usedAt: serverTimestamp(),
    }, { merge: true });

    // Link user to org
    await setDoc(doc(db, 'users', uid), {
        orgId: invite.orgId,
        role: 'worker',
    }, { merge: true });

    return { orgId: invite.orgId, orgName: invite.orgName };
}
