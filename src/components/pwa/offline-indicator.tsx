'use client';

import { useOnlineStatus } from '@/lib/use-online-status';

/**
 * Top-of-screen amber banner that appears when the device is offline.
 * Auto-hides when connectivity returns.
 *
 * The cart still works offline (it's localStorage-backed), but checkout
 * requires an online connection — the cart page uses useOnlineStatus() too
 * to disable the "place order" button while offline.
 */
export function OfflineIndicator() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[9998] flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-center text-sm font-medium text-amber-950 shadow-md"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round"/>
      </svg>
      <span>لا يوجد اتصال — السلة محفوظة، يمكنك المتابعة بعد الاتصال</span>
    </div>
  );
}
