'use client';

import { useEffect, useState } from 'react';

/**
 * Shows a small banner when a new Service Worker version is waiting to take over.
 * User taps "تحديث" → SW skips waiting → page reloads → new version active.
 *
 * Safe-by-design: if registration fails or SW is not supported, renders nothing.
 */
export function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let controllerChangeFired = false;

    const onControllerChange = () => {
      if (controllerChangeFired) return;
      controllerChangeFired = true;
      // New SW took control — reload to use the new assets
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.getRegistration('/').then((r) => {
      if (!r) return;
      reg = r;

      // If an update is already waiting (e.g., user had the tab open during deploy)
      if (r.waiting) setWaiting(r.waiting);

      // Listen for new updates discovered later
      r.addEventListener('updatefound', () => {
        const newWorker = r.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(newWorker);
          }
        });
      });

      // Poll for updates every 30 min while the tab is open
      const interval = setInterval(() => {
        r?.update().catch(() => {});
      }, 30 * 60 * 1000);

      return () => clearInterval(interval);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    if (!waiting) return;
    setUpdating(true);
    waiting.postMessage('SKIP_WAITING');
    // controllerchange listener will handle the reload
  };

  if (!waiting) return null;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed inset-x-2 bottom-2 z-[9999] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-indigo-950/95 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur supports-[backdrop-filter]:bg-indigo-950/80"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
        </span>
        <div className="text-sm">
          <div className="font-semibold">تحديث جديد متوفر</div>
          <div className="text-xs text-white/70">اضغط للحصول على آخر نسخة</div>
        </div>
      </div>
      <button
        onClick={applyUpdate}
        disabled={updating}
        className="shrink-0 rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-indigo-950 shadow-md transition hover:bg-indigo-50 active:scale-95 disabled:opacity-60"
      >
        {updating ? '...' : 'تحديث'}
      </button>
    </div>
  );
}
