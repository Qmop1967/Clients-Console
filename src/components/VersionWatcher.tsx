'use client';
import { useEffect, useRef } from 'react';

// Self-healing release watcher. Compares the build id this client bundle was
// compiled with against the build id currently served by the origin. When they
// differ, this tab is running stale code after a redeploy — we reload silently
// (on the next focus / visibility gain, or immediately if the app is in the
// background) so long-lived installed apps pick up new releases without a
// manual refresh and without a popup (PWA rule). Loop-guarded.
const BOOT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || '';

function reloadOnce(): void {
  try {
    const KEY = 'tsh_version_reload_at';
    const last = Number(sessionStorage.getItem(KEY) || '0');
    if (Date.now() - last < 30000) return; // avoid reload loops
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — reload anyway
  }
  window.location.reload();
}

export default function VersionWatcher() {
  const updateReady = useRef(false);

  useEffect(() => {
    if (!BOOT_BUILD) return; // build-id wiring absent — no-op

    const check = async (): Promise<void> => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const server: string | undefined = data?.build;
        if (server && server !== BOOT_BUILD) {
          updateReady.current = true;
          if (document.hidden) reloadOnce();
        }
      } catch {
        // network blip — retry next tick
      }
    };

    const onReturn = (): void => {
      if (updateReady.current && document.visibilityState === 'visible') reloadOnce();
    };

    const first = window.setTimeout(check, 5000);
    const iv = window.setInterval(check, 60000);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, []);

  return null;
}
