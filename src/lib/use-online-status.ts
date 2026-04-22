'use client';

import { useEffect, useState } from 'react';

/**
 * Reactive online/offline status hook.
 *
 * Starts in "online" state on SSR and first mount to avoid hydration mismatch;
 * synchronizes with `navigator.onLine` on mount and listens for changes.
 *
 * Note: `navigator.onLine` is a hint, not a guarantee. It flips true/false based
 * on network interface, not actual server reachability. Good enough for UX
 * (disable checkout button, show banner) — not for correctness decisions.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
