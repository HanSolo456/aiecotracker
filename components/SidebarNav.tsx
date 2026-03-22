'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ScanLine, Cpu, BookOpen, Leaf, LogOut, Building2, Users, BarChart2, Settings } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/components/LanguageProvider';

export default function SidebarNav() {
    const pathname         = usePathname();
    const router           = useRouter();
    const { user, profile, signOut } = useAuth();
    const { t } = useLanguage();

    // Build nav items with translated labels
    const navItems = [
        { href: '/dashboard',       label: t('nav.dashboard'),    icon: LayoutDashboard },
        { href: '/scan',            label: t('nav.scan_part'),    icon: ScanLine },
        { href: '/iot-monitor',     label: t('nav.iot_monitor'),  icon: Cpu },
        { href: '/history',         label: t('nav.reports'),      icon: BookOpen },
        { href: '/org/profile',     label: t('nav.my_org'),       icon: Building2 },
        { href: '/org/dashboard',   label: t('nav.org_dashboard'),icon: BarChart2 },
        { href: '/org/workers',     label: t('nav.workers'),      icon: Users },
        { href: '/settings',        label: t('nav.settings'),     icon: Settings },
    ];

    // Hide sidebar on auth page
    if (pathname === '/' || pathname.startsWith('/auth') || pathname.startsWith('/join')) return null;

    const sidebarName =
        profile?.displayName?.trim() ||
        user?.displayName?.trim() ||
        profile?.email?.split('@')[0] ||
        'User';
    const initials = sidebarName.includes('@')
        ? sidebarName[0]?.toUpperCase() ?? '?'
        : sidebarName.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    async function handleSignOut() {
        await signOut();
        router.replace('/auth');
    }

    return (
        <aside className="sidebar hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40">
            {/* Logo */}
            <div className="px-5 py-6 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)' }}
                    >
                        <Leaf size={15} style={{ color: '#84cc16' }} />
                    </div>
                    <div>
                        <p className="font-heading text-sm font-700 text-white leading-none">AI-EcoTrack</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Circular Waste Intelligence</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
                {navItems
                    .filter(({ href }) => !(
                        user?.isAnonymous && (href === '/iot-monitor' || href === '/org/profile' || href === '/org/dashboard' || href === '/org/workers')
                    ))
                    .filter(({ href }) => !(
                        (href === '/org/profile' || href === '/org/dashboard' || href === '/org/workers') && !profile?.orgId
                    ))
                    .filter(({ href }) => !(
                        href === '/org/workers' && profile?.role !== 'org_admin'
                    ))
                    .map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                        <button
                            key={href}
                            onClick={() => router.push(href)}
                            className={`sidebar-link ${active ? 'active' : ''}`}
                        >
                            <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
                            {label}
                        </button>
                    );
                })}
            </nav>

            <div className="px-3 py-4 border-t border-[var(--border-subtle)]">
                {profile ? (
                    <div className="flex items-center gap-3 px-2">
                        {/* Avatar */}
                        {(profile.photoURL || user?.photoURL) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.photoURL || user?.photoURL || ''} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                                style={{ background: 'rgba(132,204,22,0.15)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.3)' }}>
                                {initials}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{sidebarName}</p>
                            <p className="text-[10px] truncate capitalize" style={{ color: 'var(--text-muted)' }}>{profile.role}</p>
                        </div>
                        <button
                            onClick={handleSignOut}
                            title={t('common.sign_out')}
                            className="p-1.5 rounded-lg hover:bg-[var(--border)] transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                ) : user && !user.isAnonymous ? (
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{ background: 'var(--border)', color: 'var(--text-dim)', border: '1px solid #374151' }}>
                            {user.email?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{user.email ?? 'Signed in'}</p>
                            <p className="text-[10px]" style={{ color: '#EF4444' }}>Profile error</p>
                        </div>
                        <button
                            onClick={handleSignOut}
                            title={t('common.sign_out')}
                            className="p-1.5 rounded-lg hover:bg-[var(--border)] transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                ) : user?.isAnonymous ? (
                    <div className="px-2 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{ background: 'var(--border)', color: 'var(--text-muted)', border: '1px solid #374151' }}>
                            ?
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white">Guest</p>
                            <button
                                onClick={() => router.push('/auth')}
                                className="text-[10px] hover:underline"
                                style={{ color: '#60A5FA' }}
                            >
                                {t('nav.sign_in')} →
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>
                        v2.0 · IndiaInnovates 2026
                    </p>
                )}
            </div>
        </aside>
    );
}
