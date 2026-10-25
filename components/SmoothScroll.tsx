'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ReactLenis, useLenis } from 'lenis/react';

function LenisScrollController() {
    const pathname = usePathname();
    const lenis = useLenis();

    // Reset scroll to top on route change if no hash is present
    useEffect(() => {
        if (!lenis) return;

        if (window.location.hash) {
            const target = document.querySelector(window.location.hash);
            if (target) {
                lenis.scrollTo(target as HTMLElement, { offset: -80 });
                return;
            }
        }

        lenis.scrollTo(0, { immediate: true });
    }, [pathname, lenis]);

    // Intercept in-page hash links for seamless smooth scrolling with navbar offset
    useEffect(() => {
        if (!lenis) return;

        const handleClick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('a');
            if (!target) return;

            const href = target.getAttribute('href');
            if (href && href.startsWith('#') && href.length > 1) {
                const element = document.querySelector(href);
                if (element) {
                    e.preventDefault();
                    lenis.scrollTo(element as HTMLElement, {
                        offset: -80,
                        duration: 1.2,
                    });
                    history.pushState(null, '', href);
                }
            }
        };

        document.addEventListener('click', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
        };
    }, [lenis]);

    return null;
}

interface SmoothScrollProps {
    children: ReactNode;
}

export default function SmoothScroll({ children }: SmoothScrollProps) {
    return (
        <ReactLenis
            root
            options={{
                lerp: 0.08,
                duration: 1.2,
                smoothWheel: true,
                syncTouch: false, // Maintain responsive native touch behavior on mobile
                touchMultiplier: 1.5,
                autoRaf: true,
            }}
        >
            <LenisScrollController />
            {children}
        </ReactLenis>
    );
}

export { useLenis };
