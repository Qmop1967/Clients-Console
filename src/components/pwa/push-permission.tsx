'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { requestFcmToken, subscribeForegroundMessages } from '@/lib/firebase-messaging';

const DISMISS_KEY = 'tsh.push.dismissed';
const REGISTERED_KEY = 'tsh.push.registered';

/**
 * Push notification permission prompt for authenticated customers.
 *
 * Flow:
 * 1. Wait 30s after login (don't bother the user on arrival)
 * 2. If permission is 'default' and not dismissed → show soft prompt
 * 3. User taps "تفعيل" → requestFcmToken → POST /api/push/register
 * 4. Subscribe to foreground messages → show inline toasts
 *
 * Bails silently (returns null) if:
 * - SSR / no window
 * - Browser doesn't support Notification API
 * - User not authenticated
 * - Already registered (REGISTERED_KEY set)
 * - User dismissed the prompt (DISMISS_KEY set, cooldown 14 days)
 * - Permission already granted or denied
 */
export function PushPermission() {
  const { data: session, status } = useSession();
  const [showPrompt, setShowPrompt] = useState(false);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  // Effect 1: decide whether to show the prompt (after 30s of authenticated session)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'authenticated') return;
    if (!('Notification' in window)) return;

    // Already granted → try silent registration once
    if (Notification.permission === 'granted') {
      if (!localStorage.getItem(REGISTERED_KEY)) {
        registerSilently();
      }
      return;
    }

    // Already denied → do not pester
    if (Notification.permission === 'denied') return;

    // Previously dismissed within cooldown?
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ageDays = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
      if (ageDays < 14) return;
    }

    const timer = setTimeout(() => setShowPrompt(true), 30_000);
    return () => clearTimeout(timer);
  }, [status, session?.user?.id]);

  // Effect 2: subscribe to foreground messages once granted
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'authenticated') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    let unsub: (() => void) | null = null;
    subscribeForegroundMessages((payload) => {
      if (payload.title || payload.body) {
        setToast({ title: payload.title || 'إشعار', body: payload.body || '' });
        // Auto-dismiss after 6s
        setTimeout(() => setToast(null), 6000);
      }
    }).then((u) => { unsub = u; });

    return () => { unsub?.(); };
  }, [status]);

  async function registerSilently() {
    try {
      const token = await requestFcmToken();
      if (!token) return;
      const userId = session?.user?.odooPartnerId || session?.user?.id;
      if (!userId) return;
      const res = await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, app: 'clients', userId: Number(userId) }),
      });
      if (res.ok) localStorage.setItem(REGISTERED_KEY, String(Date.now()));
    } catch {
      // Silent — not critical
    }
  }

  async function handleEnable() {
    setWorking(true);
    try {
      const token = await requestFcmToken();
      if (!token) {
        // Permission denied or unsupported
        setShowPrompt(false);
        return;
      }
      const userId = session?.user?.odooPartnerId || session?.user?.id;
      if (!userId) {
        setShowPrompt(false);
        return;
      }
      const res = await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, app: 'clients', userId: Number(userId) }),
      });
      if (res.ok) {
        localStorage.setItem(REGISTERED_KEY, String(Date.now()));
      }
    } catch {
      // Silent fallback
    } finally {
      setWorking(false);
      setShowPrompt(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPrompt(false);
  }

  return (
    <>
      {/* Permission prompt (bottom sheet, RTL) */}
      {showPrompt && (
        <div
          dir="rtl"
          role="dialog"
          aria-live="polite"
          className="fixed inset-x-2 bottom-2 z-[9998] mx-auto max-w-md rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 dark:bg-indigo-950 dark:ring-white/10"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mb-2 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div className="flex-1 text-sm text-gray-900 dark:text-white">
              <div className="font-semibold">تفعيل الإشعارات</div>
              <div className="mt-0.5 text-xs text-gray-600 dark:text-white/70">
                لتصلك إشعارات بحالة طلباتك وتحديثات الفواتير فوراً
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDismiss}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-white/20 dark:bg-transparent dark:text-white/80 dark:hover:bg-white/5"
            >
              ليس الآن
            </button>
            <button
              onClick={handleEnable}
              disabled={working}
              className="flex-[2] rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 active:scale-95 disabled:opacity-60"
            >
              {working ? '...' : 'تفعيل'}
            </button>
          </div>
        </div>
      )}

      {/* Foreground message toast */}
      {toast && (
        <div
          dir="rtl"
          role="status"
          aria-live="polite"
          onClick={() => setToast(null)}
          className="fixed inset-x-2 top-2 z-[9999] mx-auto max-w-md cursor-pointer rounded-2xl bg-indigo-950/95 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur supports-[backdrop-filter]:bg-indigo-950/80"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold">{toast.title}</div>
              {toast.body && <div className="mt-0.5 text-xs text-white/80">{toast.body}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
