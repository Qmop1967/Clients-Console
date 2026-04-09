'use client';

import { useEffect } from 'react';

/**
 * Global Error Reporter
 * Catches unhandled errors and promise rejections on the client side
 * Reports them to /api/error-report (PM2 logs + optional Telegram)
 */
export function ErrorReporter() {
  useEffect(() => {
    function reportError(message: string, stack?: string, extra?: Record<string, unknown>) {
      try {
        const payload = {
          message,
          stack: stack || '',
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          timestamp: new Date().toISOString(),
          level: 'error' as const,
          extra,
        };

        // Use sendBeacon for reliability (survives page unload)
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/error-report', JSON.stringify(payload));
        } else {
          fetch('/api/error-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }
      } catch {
        // Silently ignore - don't create error loops
      }
    }

    function handleError(event: ErrorEvent) {
      reportError(
        event.message || 'Unknown error',
        event.error?.stack,
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportError(
        reason?.message || String(reason) || 'Unhandled promise rejection',
        reason?.stack,
        { type: 'unhandledrejection' }
      );
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
