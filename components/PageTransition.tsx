'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * A subtle transition after navigation commits, without hiding the page
 * or forcing a synchronous layout of the entire dashboard.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const animation = el.animate([{ opacity: 0.96 }, { opacity: 1 }], {
            duration: 100,
            easing: 'ease-out',
        });
        return () => animation.cancel();
    }, [pathname]);

    return (
        <div ref={ref}>
            {children}
        </div>
    );
}
