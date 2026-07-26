'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  /** True only after the server has issued a valid consent receipt. */
  measurementActive: boolean;
  accept: () => void;
  reject: () => void;
  /** Reopen the choice (change/withdraw consent). Does not fire the pixel. */
  reset: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

async function syncServerConsent(status: 'accepted' | 'rejected'): Promise<boolean> {
  try {
    const response = await fetch('/api/analytics/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function readStored(): ConsentStatus {
  if (typeof window === 'undefined') return 'unset';
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === 'accepted' || value === 'rejected' ? value : 'unset';
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const consentGenerationRef = useRef(0);
  const receiptReadyRef = useRef(false);
  const [status, setStatus] = useState<ConsentStatus>('unset');
  const [ready, setReady] = useState(false);
  const [measurementActive, setMeasurementActive] = useState(false);

  // Load persisted decision on mount and honour a prior "accepted".
  useEffect(() => {
    const stored = readStored();
    setStatus(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      consentGenerationRef.current += 1;
      receiptReadyRef.current = false;
      setMeasurementActive(false);
      const next =
        event.newValue === 'accepted' || event.newValue === 'rejected' ? event.newValue : 'unset';
      setStatus(next);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (status !== 'accepted') {
      receiptReadyRef.current = false;
      setMeasurementActive(false);
      revokeMeasurement();
      void syncServerConsent('rejected');
      return;
    }

    if (receiptReadyRef.current) {
      setMeasurementActive(true);
      activateMeasurement();
      return;
    }

    setMeasurementActive(false);
    const generation = ++consentGenerationRef.current;
    void syncServerConsent('accepted').then((saved) => {
      if (consentGenerationRef.current !== generation) {
        setMeasurementActive(false);
        void syncServerConsent('rejected');
        return;
      }
      if (!saved) {
        setMeasurementActive(false);
        revokeMeasurement();
        return;
      }
      receiptReadyRef.current = true;
      setMeasurementActive(true);
      activateMeasurement();
    });
  }, [ready, status]);

  const accept = useCallback(() => {
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, 'accepted');
    setStatus('accepted');
  }, []);

  const reject = useCallback(() => {
    consentGenerationRef.current += 1;
    receiptReadyRef.current = false;
    setMeasurementActive(false);
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, 'rejected');
    revokeMeasurement();
    setStatus('rejected');
  }, []);

  const reset = useCallback(() => {
    consentGenerationRef.current += 1;
    receiptReadyRef.current = false;
    setMeasurementActive(false);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    revokeMeasurement();
    setStatus('unset');
  }, []);

  return (
    <ConsentContext.Provider value={{ status, ready, measurementActive, accept, reject, reset }}>
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
export const pixelEnabled = (): boolean => isPixelConfigured() || isMetaPixelConfigured();
