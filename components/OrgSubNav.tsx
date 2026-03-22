'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Trophy, BarChart3, Settings } from 'lucide-react';

const LIME = '#84cc16';

export type OrgTab = 'analytics' | 'leaderboard' | 'impact' | 'settings';

const TABS: { id: OrgTab; label: string; icon: React.ElementType; href: string }[] = [
    { id: 'analytics',   label: 'Analytics',   icon: LayoutDashboard, href: '/org/dashboard'   },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy,           href: '/org/leaderboard' },
    { id: 'impact',      label: 'Impact',       icon: BarChart3,        href: '/org/impact'      },
    { id: 'settings',   label: 'Settings',    icon: Settings,         href: '/org/settings'    },
];

interface OrgSubNavProps {
    /** Tab mode: controlled externally — no routing */
    activeTab?: OrgTab;
    onTabChange?: (tab: OrgTab) => void;
}

export default function OrgSubNav({ activeTab, onTabChange }: OrgSubNavProps) {
    const pathname     = usePathname();
    const router       = useRouter();
    const scrollRef    = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const btnRefs      = useRef<any[]>([]);

    const tabs = TABS;

    // In tab mode, use the external activeTab; otherwise derive from pathname
    const tabMode   = activeTab !== undefined && !!onTabChange;
    const activeIdx = tabMode
        ? tabs.findIndex(t => t.id === activeTab)
        : tabs.findIndex(t => pathname === t.href || pathname.startsWith(`${t.href}/`));

    // Auto-scroll active tab to center
    useEffect(() => {
        const container = scrollRef.current;
        const btn       = btnRefs.current[activeIdx];
        if (!container || !btn) return;
        const target = btn.offsetLeft + btn.offsetWidth / 2 - container.offsetWidth / 2;
        container.scrollTo({ left: target, behavior: 'smooth' });
    }, [activeIdx]);

    const handleClick = (tab: typeof tabs[number], idx: number) => {
        void idx;
        if (tabMode) {
            onTabChange!(tab.id);
        } else {
            router.push(tab.href);
        }
    };

    return (
        <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-1 pt-3 pb-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
            {tabs.map((tab, idx) => {
                const active = idx === activeIdx;
                const Icon   = tab.icon;
                return (
                    <button
                        key={tab.id}
                        ref={el => { btnRefs.current[idx] = el; }}
                        onClick={() => handleClick(tab, idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 active:scale-95"
                        style={{
                            background: active ? `${LIME}18` : 'transparent',
                            color:      active ? LIME        : 'var(--text-secondary)',
                            border:     `1px solid ${active ? `${LIME}40` : 'transparent'}`,
                        }}
                    >
                        <Icon size={12} strokeWidth={active ? 2.5 : 1.8} />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
