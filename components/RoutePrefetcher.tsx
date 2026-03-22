'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const CORE_ROUTES = [
  '/dashboard',
  '/scan',
  '/history',
  '/iot-monitor',
  '/passport',
  '/guide',
  '/org/profile',
  '/org/dashboard',
  '/org/workers',
  '/org/setup',
  '/auth',
];

export default function RoutePrefetcher() {
  const router = useRouter();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;

    const prefetchAll = () => {
      CORE_ROUTES.forEach(route => {
        router.prefetch(route);
      });
    };

    // Prefetch during idle time so first paint is not impacted.
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as Window & {
        requestIdleCallback: (cb: () => void) => number;
      }).requestIdleCallback(prefetchAll);

      return () => {
        if ('cancelIdleCallback' in window) {
          (window as Window & {
            cancelIdleCallback: (idleId: number) => void;
          }).cancelIdleCallback(id);
        }
      };
    }

    const timeoutId = setTimeout(prefetchAll, 120);
    return () => clearTimeout(timeoutId);
  }, [router]);

  return null;
}
