'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

function NavigationFeedback({ children }: { children: ReactNode }) {
    const { pending } = useLinkStatus();

    return (
        <>
            {children}
            <span role="status" className="sr-only">{pending ? 'Loading page…' : ''}</span>
            <span
                aria-hidden="true"
                className={`pointer-events-none absolute right-2 top-2 h-3 w-3 rounded-full border-2 border-current border-t-transparent ${pending ? 'animate-spin' : 'invisible'}`}
            />
        </>
    );
}

/** Navigate on the first click; show feedback while an uncached route loads. */
export default function NavigationLink({ children, className, ...props }: ComponentProps<typeof Link>) {
    return (
        <Link prefetch={true} {...props} className={`relative ${className ?? ''}`}>
            <NavigationFeedback>{children}</NavigationFeedback>
        </Link>
    );
}
