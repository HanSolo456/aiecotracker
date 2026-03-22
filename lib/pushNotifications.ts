'use client';

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, firebaseApp, firebaseReady } from '@/lib/firebase';
import {
    mergeNotificationPreferences,
    notificationTokenDocId,
    type NotificationCategory,
    type NotificationPreferences,
} from '@/lib/notifications';

const TOKEN_STORAGE_KEY = 'aiecotrack-web-push-token';
export const PUSH_TOKEN_STORAGE_KEY = TOKEN_STORAGE_KEY;

type MessagingModule = typeof import('firebase/messaging');

async function getMessagingModule(): Promise<MessagingModule | null> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
        return null;
    }
    const messaging = await import('firebase/messaging');
    const supported = await messaging.isSupported().catch(() => false);
    return supported ? messaging : null;
}

async function ensureServiceWorker() {
    return navigator.serviceWorker.register('/firebase-messaging-sw.js');
}

async function getCurrentToken(vapidKey: string) {
    const messagingModule = await getMessagingModule();
    if (!messagingModule || !firebaseReady || !firebaseApp) return null;

    const registration = await ensureServiceWorker();
    const messaging = messagingModule.getMessaging(firebaseApp);

    return messagingModule.getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
    });
}

export async function isPushSupported() {
    return (await getMessagingModule()) !== null;
}

export async function getStoredNotificationPreferences(uid: string): Promise<NotificationPreferences> {
    if (!firebaseReady) return mergeNotificationPreferences(null);
    const snap = await getDoc(doc(db, 'users', uid));
    const raw = snap.exists() ? snap.data().notificationSettings : null;
    return mergeNotificationPreferences(raw);
}

export async function saveNotificationPreferences(uid: string, prefs: NotificationPreferences) {
    if (!firebaseReady) return;
    await setDoc(
        doc(db, 'users', uid),
        {
            notificationSettings: prefs,
            notificationSettingsUpdatedAt: serverTimestamp(),
        },
        { merge: true },
    );
}

async function persistToken(uid: string, token: string) {
    if (!firebaseReady) return;
    await setDoc(
        doc(db, 'users', uid, 'notificationTokens', notificationTokenDocId(token)),
        {
            token,
            platform: 'web',
            userAgent: navigator.userAgent,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
        },
        { merge: true },
    );
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export async function removeStoredPushToken(uid: string) {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;
    if (!firebaseReady) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return;
    }

    await deleteDoc(doc(db, 'users', uid, 'notificationTokens', notificationTokenDocId(token)));
    localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredPushToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function syncPushTokenForUser(uid: string) {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey || Notification.permission !== 'granted') return null;

    const token = await getCurrentToken(vapidKey);
    if (!token) return null;

    await persistToken(uid, token);
    return token;
}

export async function enablePushForUser(uid: string) {
    if (!(await isPushSupported())) {
        throw new Error('Push notifications are not supported in this browser.');
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
        throw new Error('NEXT_PUBLIC_FIREBASE_VAPID_KEY is not configured.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Notification permission was not granted.');
    }

    const token = await getCurrentToken(vapidKey);
    if (!token) {
        throw new Error('Failed to get a push token from Firebase Messaging.');
    }

    await persistToken(uid, token);
    return token;
}

export async function disablePushForUser(uid: string) {
    await removeStoredPushToken(uid);
}

export async function sendTestNotification(user: User, category: NotificationCategory) {
    const idToken = await user.getIdToken();
    const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ category }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'Failed to send test notification.');
    }

    return data;
}

export async function attachForegroundMessageListener(
    onReceive: (payload: { title: string; body: string; link?: string }) => void,
) {
    const messagingModule = await getMessagingModule();
    if (!messagingModule || !firebaseReady || !firebaseApp) return () => {};

    const messaging = messagingModule.getMessaging(firebaseApp);
    return messagingModule.onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? payload.data?.title ?? 'Notification';
        const body = payload.notification?.body ?? payload.data?.body ?? '';
        const link = payload.data?.link;
        onReceive({ title, body, link });
    });
}
