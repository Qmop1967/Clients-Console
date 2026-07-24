/**
 * TikTok Pixel — consent-first, PII-free scaffold.
 *
 * WHY (2026-07-24): TikTok ads launch readiness. The pixel must never load or fire
 * before the visitor explicitly Accepts (see components/analytics/consent-context).
 * Activation is gated on a single public env var so a missing/empty id keeps the whole
 * pipeline dormant in every environment that has not opted in.
 *
 * NO PII: this module only ever forwards catalog-level, non-identifying properties.
 * Never pass email, phone, name, address, or any account identifier through here.
 *
 * event_id: every tracked event carries a client-generated event_id. This is the
 * dedup key the server-side Events API will reuse later, so a browser pixel hit and a
 * future server event describing the same action collapse into one on TikTok's side.
 */

export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "";

/** Standard TikTok events we intend to use. Kept small and intentional. */
export type TikTokEventName =
  | "ViewContent"
  | "ClickButton"
  | "Contact"
  | "ViewCatalog";

/**
 * Whitelisted, non-identifying event properties. This shape is the guardrail that
 * keeps PII out of the pixel — there is deliberately no field for email/phone/name.
 */
export interface TikTokEventProperties {
  content_id?: string;
  content_type?: "product";
  content_name?: string;
  content_category?: string;
  currency?: string;
  value?: number;
}

interface Ttq {
  push: (...args: unknown[]) => void;
  page: () => void;
  track: (
    event: string,
    properties?: Record<string, unknown>,
    options?: { event_id?: string },
  ) => void;
  load: (id: string, options?: Record<string, unknown>) => void;
  grantConsent?: () => void;
  revokeConsent?: () => void;
  [key: string]: unknown;
}

declare global {
  interface Window {
    ttq?: Ttq;
    TiktokAnalyticsObject?: string;
    __ttqLoaded?: boolean;
    __ttqConsentGranted?: boolean;
  }
}

/** True only when an activation id is present. No id -> pixel stays fully dormant. */
export function isPixelConfigured(): boolean {
  return TIKTOK_PIXEL_ID.length > 0;
}

/** Dedup key shared with the future server-side Events API. */
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/** Installs the TikTok method-queue stub. Mirrors the vendor bootstrap snippet. */
function bootstrapTtq(): void {
  window.TiktokAnalyticsObject = "ttq";
  const ttq = (window.ttq || []) as unknown as Ttq & {
    methods?: string[];
    setAndDefer?: (target: Record<string, unknown>, method: string) => void;
    _i?: Record<string, unknown[]>;
    _t?: Record<string, number>;
    _o?: Record<string, unknown>;
  };
  window.ttq = ttq as unknown as Ttq;

  ttq.methods = [
    "page", "track", "identify", "instances", "debug", "on", "off", "once",
    "ready", "alias", "group", "enableCookie", "disableCookie",
    "holdConsent", "revokeConsent", "grantConsent",
  ];
  ttq.setAndDefer = function (target, method) {
    target[method] = function (...args: unknown[]) {
      (target as unknown as { push: (v: unknown) => void }).push([method, ...args]);
    };
  };
  for (const method of ttq.methods) ttq.setAndDefer(ttq as unknown as Record<string, unknown>, method);

  ttq.load = function (id, options) {
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[id] = [];
    ttq._t = ttq._t || {};
    ttq._t[id] = Date.now();
    ttq._o = ttq._o || {};
    ttq._o[id] = options || {};
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = `${url}?sdkid=${id}&lib=ttq`;
    const first = document.getElementsByTagName("script")[0];
    first.parentNode?.insertBefore(script, first);
  };
}

/**
 * Loads the pixel exactly once. Call this ONLY after explicit consent.
 * No-op on the server, when no id is configured, or when already loaded.
 */
export function loadTikTokPixel(): void {
  if (typeof window === "undefined" || !isPixelConfigured()) return;
  if (!window.__ttqLoaded) {
    bootstrapTtq();
    window.ttq?.load(TIKTOK_PIXEL_ID);
    window.__ttqLoaded = true;
  }
  window.ttq?.grantConsent?.();
  window.__ttqConsentGranted = true;
}

/**
 * Withdraws runtime consent and blocks every subsequent event immediately. The
 * vendor script may remain after a previous acceptance, but receives revocation and
 * every local tracking helper fails closed.
 */
export function revokeTikTokConsent(): void {
  if (typeof window === "undefined") return;
  window.__ttqConsentGranted = false;
  if (window.__ttqLoaded) window.ttq?.revokeConsent?.();
}

/** Fires PageView. Safe to call repeatedly; no-op until the pixel is loaded. */
export function trackPageView(): void {
  if (
    typeof window === "undefined" ||
    !window.__ttqLoaded ||
    !window.__ttqConsentGranted
  ) return;
  window.ttq?.page();
}

/**
 * Tracks a standard event with a dedup-ready event_id. Returns the event_id (or null
 * if the pixel is not active) so a caller can forward the same id to a server event.
 */
export function trackEvent(
  name: TikTokEventName,
  properties: TikTokEventProperties = {},
): string | null {
  if (
    typeof window === "undefined" ||
    !window.__ttqLoaded ||
    !window.__ttqConsentGranted
  ) return null;
  const eventId = generateEventId();
  window.ttq?.track(name, properties as Record<string, unknown>, { event_id: eventId });
  return eventId;
}
