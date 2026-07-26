'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  isPixelConfigured,
  loadTikTokPixel,
  revokeTikTokConsent,
  trackPageView,
} from '@/lib/analytics/tiktok';
import {
  isMetaPixelConfigured,
  loadMetaPixel,
  MEASUREMENT_CONSENT_GRANTED_EVENT,
  revokeMetaConsent,
  trackMetaPageView,
} from '@/lib/analytics/meta';

/**
 * Consent-first gate for TSH advertising measurement.
 *
 * State is persisted in localStorage so a decision (Accept OR Reject) survives reloads
 * and the banner does not nag a visitor who already chose. Vendor pixels are loaded and
 * PageView is fired ONLY after an explicit "accepted" — never on "unset" or "rejected".
 *
 * This is a new versioned decision. A historical TikTok-only acceptance is deliberately
 * not interpreted as consent for Meta.
 */

export type ConsentStatus = 'unset' | 'accepted' | 'rejected';

const STORAGE_KEY = 'tsh_measurement_consent_v2';
const LEGACY_TIKTOK_STORAGE_KEY = 'tsh_tt_consent';
const LEGACY_TIKTOK_GRANTED_EVENT = 'tsh:tiktok-consent-granted';

function activateMeasurement(): void {
  loadTikTokPixel();
  loadMetaPixel();
  trackPageView();
  trackMetaPageView();
  window.dispatchEvent(new Event(MEASUREMENT_CONSENT_GRANTED_EVENT));
  // Compatibility for the existing TikTok campaign components.
  window.dispatchEvent(new Event(LEGACY_TIKTOK_GRANTED_EVENT));
}

function revokeMeasurement(): void {
  revokeTikTokConsent();
  revokeMetaConsent();
}

interface ConsentContextValue {
  status: ConsentStatus;
  /** True once localStorage has been read — avoids a flash before hydration. */
  ready: boolean;
  accept: () => void;
  reject: () => void;
  /** Reopen the choice (change/withdraw consent). Does not fire the pixel. */
  reset: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStored(): ConsentStatus {
  if (typeof window === 'undefined') return 'unset';
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === 'accepted' || value === 'rejected' ? value : 'unset';
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus>('unset');
  const [ready, setReady] = useState(false);

  // Load persisted decision on mount and honour a prior "accepted".
  useEffect(() => {
    const stored = readStored();
    setStatus(stored);
    setReady(true);
    if (stored === 'accepted') {
      activateMeasurement();
    }
  }, []);

  const accept = useCallback(() => {
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, 'accepted');
    setStatus('accepted');
    activateMeasurement();
  }, []);

  const reject = useCallback(() => {
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, 'rejected');
    revokeMeasurement();
    setStatus('rejected');
  }, []);

  const reset = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    revokeMeasurement();
    setStatus('unset');
  }, []);

  return (
    <ConsentContext.Provider value={{ status, ready, accept, reject, reset }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within a ConsentProvider');
  return ctx;
}

/** Whether at least one measurement pixel can run in this deployment. */
export const pixelEnabled = (): boolean =>
  isPixelConfigured() || isMetaPixelConfigured();
