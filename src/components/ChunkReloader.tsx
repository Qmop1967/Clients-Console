'use client';
import { useEffect } from 'react';

// Detects failed JS/CSS chunk loads. This happens when the app tab stays open
// across a redeploy and a lazily-loaded route chunk no longer exists on the
// server (404). Without recovery the page renders but never hydrates, so
// buttons/inputs are dead. We reload once, guarded against reload loops.
function isChunkError(msg?: string | null): boolean {
  if (!msg) return false;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    msg
  );
}

function reloadOnce() {
  try {
    const KEY = 'tsh_chunk_reload_at';
    const last = Number(sessionStorage.getItem(KEY) || '0');
    const now = Date.now();
    if (now - last < 15000) return; // already reloaded recently — avoid loop
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // sessionStorage unavailable — reload anyway
  }
  window.location.reload();
}

export default function ChunkReloader() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const name = e.error && (e.error as Error).name;
      if (isChunkError(name) || isChunkError(e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as Error | undefined;
      if (isChunkError(r?.name) || isChunkError(r?.message || String(e.reason))) reloadOnce();
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
