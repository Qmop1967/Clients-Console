'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker at root scope ('/').
 *
 * Registering at '/' (not '/ar/' or '/en/') is REQUIRED for iOS Safari
 * to treat the install as a real PWA and preserve cookies across
 * close/reopen cycles. The SW file itself MUST be served from /sw.js.
 *
 * This component renders nothing. Safe to include on every page.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Guard: SW is not supported (older browsers, http://, some privacy modes)
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Guard: only register in production builds to avoid dev HMR conflicts.
    if (process.env.NODE_ENV !== 'production') return;

    // Register after the page is interactive so it doesn't compete with
    // initial render/paint. iOS Safari is sensitive to early SW registration.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Nothing to do on success — SW is managing itself.
          // If an update is waiting, it will take over on next navigation.
          if (reg.waiting) {
            reg.waiting.postMessage('SKIP_WAITING');
          }
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // A new version is ready. Prompt it to take over.
                newWorker.postMessage('SKIP_WAITING');
              }
            });
          });
        })
        .catch((err) => {
          // SW registration failing is not critical — the app still works.
          // Just log it once for diagnostics.
          console.warn('[SW] Registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
