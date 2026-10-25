'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

const CORE_ROUTES = [
  '/dashboard',
  '/scan',
  '/history',
];

export default function RoutePrefetcher() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    // Warm the three frequent destinations after sign-in. Visible links handle
    // other routes, avoiding a burst of requests for every org/setup page.
    if (loading || !user || hasPrefetched.current) return;
    const prefetchAll = () => {
      // Mark only when work runs. Strict Mode cancels and reruns this effect;
      // marking before scheduling would skip prefetching on the second setup.
      if (hasPrefetched.current) return;
      hasPrefetched.current = true;
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
  }, [router, user?.uid, loading]);

  return null;
}
