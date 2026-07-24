"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  isPixelConfigured,
  loadTikTokPixel,
  revokeTikTokConsent,
  trackPageView,
} from "@/lib/analytics/tiktok";

/**
 * Consent-first gate for the TikTok Pixel.
 *
 * State is persisted in localStorage so a decision (Accept OR Reject) survives reloads
 * and the banner does not nag a visitor who already chose. The pixel is loaded and
 * PageView fired ONLY after an explicit "accepted" — never on "unset" or "rejected".
 * A change-consent control lets the visitor reopen the choice and withdraw at any time.
 */

export type ConsentStatus = "unset" | "accepted" | "rejected";

const STORAGE_KEY = "tsh_tt_consent";

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
  if (typeof window === "undefined") return "unset";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "accepted" || value === "rejected" ? value : "unset";
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus>("unset");
  const [ready, setReady] = useState(false);

  // Load persisted decision on mount and honour a prior "accepted".
  useEffect(() => {
    const stored = readStored();
    setStatus(stored);
    setReady(true);
    if (stored === "accepted") {
      loadTikTokPixel();
      trackPageView();
    }
  }, []);

  const accept = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setStatus("accepted");
    loadTikTokPixel();
    trackPageView();
  }, []);

  const reject = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "rejected");
    revokeTikTokConsent();
    setStatus("rejected");
  }, []);

  const reset = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    revokeTikTokConsent();
    setStatus("unset");
  }, []);

  return (
    <ConsentContext.Provider value={{ status, ready, accept, reject, reset }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within a ConsentProvider");
  return ctx;
}

/** Whether the pixel can ever run in this deployment (id configured). */
export const pixelEnabled = isPixelConfigured;
