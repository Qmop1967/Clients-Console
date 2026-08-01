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
 * Consent gate for TSH advertising measurement.
 *
 * Two lawful bases, chosen by where the visitor is:
 *
 *   explicit — the visitor clicked Accept. Required in the EU/EEA/UK/CH before any
 *              pixel may load. Persisted to localStorage so the banner stops nagging.
 *   implied  — legitimate interest. Outside prior-consent regions the pixel runs with a
 *              visible notice and a one-click opt-out. Deliberately NOT persisted: an
 *              un-clicked default is not a decision, so the notice keeps showing and the
 *              visitor can still turn it off.
 *
 * The region call is made by the SERVER (/api/analytics/consent reads the Cloudflare
 * country header). A browser claiming `implied` from Frankfurt is refused there, and this
 * provider falls back to the opt-in banner. Doing it client-side would be advisory only.
 *
 * A historical TikTok-only acceptance is deliberately not read as consent for Meta.
 */

export type ConsentStatus = 'unset' | 'accepted' | 'rejected';
/** How the current status was arrived at. `null` while undecided. */
export type ConsentBasis = 'explicit' | 'implied' | null;

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
  /** How the status was reached — drives whether the UI is a choice or a notice. */
  basis: ConsentBasis;
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

interface SyncResult {
  saved: boolean;
  /** Server refused an `implied` basis because the visitor is in a prior-consent region. */
  priorConsentRequired: boolean;
}

async function syncServerConsent(
  status: 'accepted' | 'rejected',
  basis: Exclude<ConsentBasis, null>,
): Promise<SyncResult> {
  try {
    const response = await fetch('/api/analytics/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status, basis }),
    });
    if (!response.ok) return { saved: false, priorConsentRequired: false };
    const body = (await response.json().catch(() => null)) as
      | { saved?: boolean; priorConsentRequired?: boolean }
      | null;
    return {
      saved: body?.saved === true,
      priorConsentRequired: body?.priorConsentRequired === true,
    };
  } catch {
    return { saved: false, priorConsentRequired: false };
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
  const [basis, setBasis] = useState<ConsentBasis>(null);
  const [ready, setReady] = useState(false);
  const [measurementActive, setMeasurementActive] = useState(false);

  // Load any persisted decision. Absent one, start from legitimate interest and let the
  // server decide whether this visitor's region permits it.
  useEffect(() => {
    const stored = readStored();
    if (stored === 'unset') {
      setStatus('accepted');
      setBasis('implied');
    } else {
      setStatus(stored);
      setBasis('explicit');
    }
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
      setBasis(next === 'unset' ? null : 'explicit');
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
      void syncServerConsent('rejected', 'explicit');
      return;
    }

    if (receiptReadyRef.current) {
      setMeasurementActive(true);
      activateMeasurement();
      return;
    }

    setMeasurementActive(false);
    const generation = ++consentGenerationRef.current;
    const attemptedBasis: Exclude<ConsentBasis, null> = basis === 'implied' ? 'implied' : 'explicit';

    void syncServerConsent('accepted', attemptedBasis).then((result) => {
      if (consentGenerationRef.current !== generation) {
        setMeasurementActive(false);
        void syncServerConsent('rejected', 'explicit');
        return;
      }
      // Prior-consent region: legitimate interest is not available. Ask properly.
      if (result.priorConsentRequired) {
        receiptReadyRef.current = false;
        setMeasurementActive(false);
        revokeMeasurement();
        setBasis(null);
        setStatus('unset');
        return;
      }
      if (!result.saved) {
        setMeasurementActive(false);
        revokeMeasurement();
        return;
      }
      receiptReadyRef.current = true;
      setMeasurementActive(true);
      activateMeasurement();
    });
  }, [ready, status, basis]);

  const accept = useCallback(() => {
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, 'accepted');
    setBasis('explicit');
    setStatus('accepted');
  }, []);

  const reject = useCallback(() => {
    consentGenerationRef.current += 1;
    receiptReadyRef.current = false;
    setMeasurementActive(false);
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, 'rejected');
    revokeMeasurement();
    setBasis('explicit');
    setStatus('rejected');
  }, []);

  const reset = useCallback(() => {
    consentGenerationRef.current += 1;
    receiptReadyRef.current = false;
    setMeasurementActive(false);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_TIKTOK_STORAGE_KEY);
    revokeMeasurement();
    setBasis(null);
    setStatus('unset');
  }, []);

  return (
    <ConsentContext.Provider
      value={{ status, basis, ready, measurementActive, accept, reject, reset }}
    >
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
