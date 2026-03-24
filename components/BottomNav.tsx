'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ScanLine, LayoutDashboard, BookOpen, Cpu, LogIn, Building2 } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/components/LanguageProvider';

function BottomNavInner() {
    const pathname     = usePathname();
    const searchParams = useSearchParams();
    const router       = useRouter();
    const fromHistory  = searchParams.get('from') === 'history';
    const { user, profile } = useAuth();
    const { t } = useLanguage();
    const isPublicRoute = pathname === '/' || pathname.startsWith('/auth') || pathname.startsWith('/join');

    const isAnonymous = user?.isAnonymous;
    const hasOrg      = !isAnonymous && !!profile?.orgId;

    // Build tab list based on user state
    const tabs = useMemo(() => [
        { href: '/dashboard',    label: t('nav.home'),    icon: LayoutDashboard },
        { href: '/scan',         label: t('nav.scan'),    icon: ScanLine },
        // Sensors hidden from anonymous guests
        ...(!isAnonymous ? [{ href: '/iot-monitor', label: t('nav.iot'), icon: Cpu }] : []),
        { href: '/history',      label: t('nav.reports'), icon: BookOpen },
        // 5th slot: My Org for org members, Sign In for guests, nothing for others
        ...(hasOrg
            ? [{ href: '/org/dashboard', label: t('nav.my_org'),  icon: Building2 }]
            : isAnonymous
            ? [{ href: '/auth',          label: t('nav.sign_in'), icon: LogIn, tint: '#60A5FA' as const }]
            : []
        ),
    ], [hasOrg, isAnonymous, t]);

    const isTabActive = (href: string) => {
        if (fromHistory) return href === '/history';
        if (pathname.startsWith('/settings')) {
            if (hasOrg) return href === '/org/dashboard';
            if (isAnonymous) return href === '/auth';
            return href === '/dashboard';
        }
        if (href === '/org/dashboard') return pathname.startsWith('/org') || pathname.startsWith('/drop-off');
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const activeIndex = Math.max(0, tabs.findIndex(tab => isTabActive(tab.href)));
    const [visualIndex, setVisualIndex] = useState(activeIndex);
    const [animating, setAnimating] = useState(false);
    const [indicatorDurationMs, setIndicatorDurationMs] = useState(180);

    useEffect(() => {
        if (!animating) setVisualIndex(activeIndex);
    }, [activeIndex, animating]);

    useEffect(() => {
        // Route has changed; unlock nav interactions on the new page.
        setAnimating(false);
    }, [pathname]);

    useEffect(() => {
        // Warm route bundles/data to reduce perceived delay after indicator lands.
        tabs.forEach(tab => {
            router.prefetch(tab.href);
        });
    }, [router, tabs]);

    const handleTabPress = async (targetHref: string, targetIndex: number) => {
        if (animating) return;

        // If already on this tab, navigate to its root (e.g. /org/settings → /org/profile)
        if (targetIndex === activeIndex) {
            if (pathname !== targetHref) {
                router.push(targetHref);
            }
            return;
        }

        setAnimating(true);

        // Ensure target route is warmed when user taps.
        router.prefetch(targetHref);

        const distance = Math.abs(targetIndex - visualIndex);
        const duration = Math.min(460, 140 + distance * 80);
        setIndicatorDurationMs(duration);
        setVisualIndex(targetIndex);

        // Let glide complete before navigating.
        await new Promise(resolve => setTimeout(resolve, duration + 20));
        router.push(targetHref);
    };


    if (isPublicRoute) return null;

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[2000] safe-bottom" style={{ willChange: 'transform' }}>
            {/* Reduced side padding so 5 tabs fit comfortably */}
            <div className="px-2 pb-2">
                <div
                    className="relative rounded-2xl p-1"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                    {/* Shared active indicator that moves between tabs */}
                    <div
                        aria-hidden
                        className="absolute rounded-xl pointer-events-none"
                        style={{
                            top: 4,
                            bottom: 4,
                            left: 4,
                            width: `calc((100% - 8px) / ${tabs.length})`,
                            transform: `translateX(${visualIndex * 100}%)`,
                            transition: `transform ${indicatorDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                            background: 'rgba(132,204,22,0.12)',
                        }}
                    />

                    <div
                        className="relative z-10 grid"
                        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
                    >
                    {tabs.map(({ href, label, icon: Icon, tint }, idx) => {
                        const active = idx === visualIndex;
                        return (
                            <button
                                key={href}
                                onClick={() => { void handleTabPress(href, idx); }}
                                disabled={animating}
                                className={`nav-tab active:scale-95 transition-all duration-150 ${active ? 'active' : ''}`}
                                style={tint && !active ? { color: tint } : undefined}
                            >
                                <Icon size={17} strokeWidth={active ? 2.5 : 1.5} />
                                <span style={{ fontSize: '10px' }}>{label}</span>
                            </button>
                        );
                    })}
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default function BottomNav() {
    return (
        <Suspense fallback={null}>
            <BottomNavInner />
        </Suspense>
    );
}
