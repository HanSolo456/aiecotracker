'use client';

import { useEffect, useState } from 'react';

export default function EcoCursorFollower() {
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState({ x: -100, y: -100 });
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Only show ambient cursor follower on desktop fine pointer devices
        if (typeof window === 'undefined' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return;
        }

        setMounted(true);

        const onMouseMove = (e: MouseEvent) => {
            setCoords({ x: e.clientX, y: e.clientY });
            setIsVisible(true);

            const target = e.target as HTMLElement | null;
            if (target) {
                const clickable = target.closest('a, button, [role="button"], input, select, textarea, label, summary, .clickable');
                setIsHovered(Boolean(clickable));
            }
        };

        const onMouseLeave = () => setIsVisible(false);
        const onMouseEnter = () => setIsVisible(true);

        window.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('mouseleave', onMouseLeave);
        document.addEventListener('mouseenter', onMouseEnter);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseleave', onMouseLeave);
            document.removeEventListener('mouseenter', onMouseEnter);
        };
    }, []);

    if (!mounted) return null;

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[999999] select-none"
            style={{
                left: `${coords.x}px`,
                top: `${coords.y}px`,
                transform: 'translate(-50%, -50%)',
                opacity: isVisible ? 1 : 0,
                transition: 'opacity 0.25s ease-out',
            }}
        >
            <div
                className="rounded-full transition-all duration-200 ease-out"
                style={{
                    width: isHovered ? '32px' : '16px',
                    height: isHovered ? '32px' : '16px',
                    border: isHovered ? '1.5px solid rgba(132, 204, 22, 0.7)' : '1px solid rgba(132, 204, 22, 0.35)',
                    background: isHovered
                        ? 'radial-gradient(circle, rgba(132, 204, 22, 0.18) 0%, rgba(16, 185, 129, 0.05) 60%, transparent 100%)'
                        : 'radial-gradient(circle, rgba(132, 204, 22, 0.12) 0%, transparent 80%)',
                    boxShadow: isHovered
                        ? '0 0 16px rgba(132, 204, 22, 0.4), inset 0 0 8px rgba(132, 204, 22, 0.2)'
                        : '0 0 8px rgba(132, 204, 22, 0.15)',
                    transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                }}
            />
        </div>
    );
}
