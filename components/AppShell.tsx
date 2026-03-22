'use client';

import { usePathname } from 'next/navigation';
import SidebarNav from '@/components/SidebarNav';
import PageTransition from '@/components/PageTransition';

const PUBLIC_CHROMELESS_ROUTES = ['/', '/auth', '/join'];

function matchesRoute(pathname: string, route: string) {
    if (route === '/') return pathname === '/';
    return pathname === route || pathname.startsWith(`${route}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isChromeless = PUBLIC_CHROMELESS_ROUTES.some((route) => matchesRoute(pathname, route));

    return (
        <>
            {!isChromeless && <SidebarNav />}

            <div className={isChromeless ? 'min-h-screen' : 'lg:pl-[240px] min-h-screen'}>
                <div className={isChromeless ? 'min-h-screen' : 'mx-auto max-w-md lg:max-w-5xl'}>
                    <PageTransition>{children}</PageTransition>
                </div>
            </div>
        </>
    );
}
