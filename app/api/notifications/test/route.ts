import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import {
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_CATEGORY_META,
    mergeNotificationPreferences,
    notificationTokenDocId,
    type NotificationCategory,
} from '@/lib/notifications';
import { checkRateLimit } from '@/lib/requestRateLimit';

function getBearerToken(req: NextRequest) {
    const header = req.headers.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
}

export async function POST(req: NextRequest) {
    try {
        const bearer = getBearerToken(req);
        if (!bearer) {
            return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
        }

        const adminApp = initializeAdmin();
        const decoded = await getAuth(adminApp).verifyIdToken(bearer);
        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'notifications-test',
            keySuffix: decoded.uid,
            limit: 6,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } },
            );
        }

        const body = await req.json().catch(() => ({}));
        const category = body?.category as NotificationCategory;

        if (!NOTIFICATION_CATEGORIES.includes(category)) {
            return NextResponse.json({ error: 'Invalid notification category.' }, { status: 400 });
        }

        const db = getFirestore(adminApp);
        const userRef = db.collection('users').doc(decoded.uid);
        const userSnap = await userRef.get();
        const prefs = mergeNotificationPreferences(userSnap.exists ? userSnap.data()?.notificationSettings : null);

        if (!prefs.enabled) {
            return NextResponse.json({ error: 'Push notifications are disabled for this user.' }, { status: 400 });
        }

        if (!prefs[category]) {
            return NextResponse.json({ error: 'This notification category is disabled.' }, { status: 400 });
        }

        const tokensSnap = await userRef.collection('notificationTokens').get();
        const tokens = tokensSnap.docs
            .map((doc) => doc.data()?.token)
            .filter((token): token is string => typeof token === 'string' && token.length > 0);

        if (tokens.length === 0) {
            return NextResponse.json({ error: 'No push-enabled devices are registered for this account.' }, { status: 400 });
        }

        const meta = NOTIFICATION_CATEGORY_META[category];
        const response = await getMessaging(adminApp).sendEachForMulticast({
            tokens,
            notification: {
                title: meta.testTitle,
                body: meta.testBody,
            },
            data: {
                title: meta.testTitle,
                body: meta.testBody,
                link: meta.testPath,
                category,
            },
            webpush: {
                fcmOptions: {
                    link: meta.testPath,
                },
                notification: {
                    title: meta.testTitle,
                    body: meta.testBody,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-192.png',
                },
            },
        });

        const staleTokens = response.responses
            .map((result: { error?: { code?: string } }, index: number) => ({ result, token: tokens[index] }))
            .filter(({ result }: { result: { error?: { code?: string } } }) => {
                const code = result.error?.code;
                return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
            });

        await Promise.all(
            staleTokens.map(({ token }: { token: string }) => userRef.collection('notificationTokens').doc(notificationTokenDocId(token)).delete()),
        );

        return NextResponse.json({
            success: true,
            sent: response.successCount,
            failed: response.failureCount,
        });
    } catch (error) {
        console.error('[notifications/test] failed:', error);
        return NextResponse.json({ error: 'Failed to send test notification.' }, { status: 500 });
    }
}
