'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Wraps page content and plays a smooth fade+slide-up animation
 * every time the pathname changes (i.e. on every navigation).
 * Uses CSS only — no extra dependencies.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Remove class so it can be re-applied to restart animation
        el.classList.remove('page-enter');
        // Force reflow to restart the animation
        void el.offsetHeight;
        el.classList.add('page-enter');
    }, [pathname]);

    return (
        <div ref={ref} className="page-enter">
            {children}
        </div>
    );
}
