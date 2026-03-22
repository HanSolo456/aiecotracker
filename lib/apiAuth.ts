import type { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import type { UserRole } from '@/lib/authContext';

export type ApiUserProfile = {
    uid: string;
    role: UserRole;
    orgId: string | null;
};

export function getBearerToken(req: NextRequest): string | null {
    const header = req.headers.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
}

export async function requireUserProfile(req: NextRequest): Promise<ApiUserProfile> {
    const token = getBearerToken(req);
    if (!token) throw new Error('MISSING_BEARER');

    const app = initializeAdmin();
    const decoded = await getAuth(app).verifyIdToken(token);
    const db = getFirestore(app);
    const userSnap = await db.collection('users').doc(decoded.uid).get();

    if (!userSnap.exists) throw new Error('PROFILE_NOT_FOUND');
    const data = userSnap.data();
    return {
        uid: decoded.uid,
        role: (data?.role ?? 'worker') as UserRole,
        orgId: data?.orgId ?? null,
    };
}
