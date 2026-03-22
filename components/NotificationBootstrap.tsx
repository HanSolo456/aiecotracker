'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { attachForegroundMessageListener, syncPushTokenForUser } from '@/lib/pushNotifications';

type ForegroundMessage = {
    title: string;
    body: string;
    link?: string;
};

export default function NotificationBootstrap() {
    const { user, loading } = useAuth();
    const [message, setMessage] = useState<ForegroundMessage | null>(null);

    async function showSystemNotification(payload: ForegroundMessage) {
        if (typeof window === 'undefined') return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (!('serviceWorker' in navigator)) return;

        try {
            const registration =
                (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) ||
                (await navigator.serviceWorker.ready);

            await registration.showNotification(payload.title, {
                body: payload.body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                data: { link: payload.link || '/' },
                tag: `aiecotrack-${payload.title}`,
            });
        } catch {
            // Ignore notification display failures and keep in-app toast fallback.
        }
    }

    useEffect(() => {
        if (loading || !user || user.isAnonymous) return;

        syncPushTokenForUser(user.uid).catch(() => {});
    }, [loading, user]);

    useEffect(() => {
        let mounted = true;
        let unsubscribe = () => {};

        attachForegroundMessageListener((payload) => {
            if (!mounted) return;
            showSystemNotification(payload).catch(() => {});
            setMessage(payload);
            window.setTimeout(() => {
                setMessage((current) => (current === payload ? null : current));
            }, 5000);
        }).then((fn) => {
            unsubscribe = fn;
        }).catch(() => {});

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    if (!message) return null;

    return (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 px-1">
            <div
                className="w-full rounded-2xl border p-4 text-left shadow-2xl"
                style={{
                    background: 'rgba(8,15,34,0.96)',
                    borderColor: 'rgba(148,163,184,0.22)',
                    boxShadow: '0 20px 48px rgba(2,6,23,0.42)',
                }}
            >
                <div className="flex items-start gap-3">
                    <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.2)' }}
                    >
                        <Bell size={16} style={{ color: 'var(--lime)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{message.title}</p>
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {message.body}
                        </p>
                        {message.link && (
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.href = message.link!;
                                }}
                                className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold"
                                style={{
                                    background: 'rgba(59,130,246,0.12)',
                                    border: '1px solid rgba(96,165,250,0.2)',
                                    color: '#93C5FD',
                                }}
                            >
                                Open
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setMessage(null);
                        }}
                        className="rounded-lg p-1"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
