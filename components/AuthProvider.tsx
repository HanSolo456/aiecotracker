'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContextProvider, useAuth } from '@/lib/authContext';

/**
 * After Google redirect OAuth, Firebase often lands on `/` or `/auth`.
 * Centralizes post-login routing so we don't rely only on the /auth page mounting.
 */
function PostAuthRedirect() {
    const { user, profile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) return;

        const onLanding = pathname === '/' || pathname === '/auth';
        if (!onLanding) return;

        if (profile?.role === 'superadmin') {
            router.replace('/superadmin/factory-devices');
            return;
        }
        router.replace(profile?.orgId ? '/dashboard' : '/org/onboarding');
    }, [user, profile, loading, pathname, router]);

    return null;
}

// Public routes that don't require auth
const PUBLIC_ROUTES = ['/', '/auth', '/auth/desktop-google', '/join', '/impact'];
// Routes exempt from the org-setup redirect
const ORG_EXEMPT = ['/', '/auth', '/auth/desktop-google', '/org/setup', '/org/onboarding', '/join', '/impact'];

function matchesRoute(pathname: string, route: string) {
    if (route === '/') return pathname === '/';
    return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Inner component — runs inside AuthContextProvider so it can use useAuth().
 * Redirects unauthenticated users to /auth.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return;
        const isPublic = PUBLIC_ROUTES.some((route) => matchesRoute(pathname, route));
        // Not logged in at all → auth page
        if (!user && !isPublic) {
            router.replace('/auth');
            return;
        }
        // Logged in with real account but no org yet → setup
        const isOrgExempt = ORG_EXEMPT.some((route) => matchesRoute(pathname, route));
        if (user && !user.isAnonymous && profile !== null && profile.orgId === null && !isOrgExempt && profile.role !== 'superadmin') {
            router.replace('/org/setup');
        }
    }, [user, profile, loading, pathname, router]);

    if (loading) return null;

    return <>{children}</>;
}

/**
 * Drop-in replacement for the old AuthProvider.
 * Wraps the app in AuthContextProvider + implements the route guard.
 */
export default function AuthProvider({ children }: { children?: React.ReactNode }) {
    return (
        <AuthContextProvider>
            <PostAuthRedirect />
            <AuthGuard>{children}</AuthGuard>
        </AuthContextProvider>
    );
}
