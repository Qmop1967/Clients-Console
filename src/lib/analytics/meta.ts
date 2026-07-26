/**
 * Meta Pixel — explicit-consent, first-party measurement.
 *
 * The browser pixel never loads before the visitor accepts the versioned
 * measurement consent. Direct identifiers (name, email, phone, address and
 * account ids) are intentionally not accepted by this module.
 *
 * For deduplication, the same event_id is sent as the Pixel eventID and, when
 * the server bridge is enabled, as the Conversions API event_id.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
const META_CAPI_BROWSER_BRIDGE_ENABLED = process.env.NEXT_PUBLIC_META_CAPI_ENABLED === 'true';

export const MEASUREMENT_CONSENT_GRANTED_EVENT = 'tsh:measurement-consent-granted';

export type MetaEventName =
  'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

export interface MetaEventProperties {
  content_ids?: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  content_type?: 'product';
  content_name?: string;
  content_category?: string;
  currency?: string;
  value?: number;
  num_items?: number;
}

interface MetaTrackOptions {
  eventId?: string;
  sendServer?: boolean;
}

interface Fbq {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: Fbq;
  loaded?: boolean;
  version?: string;
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    __tshMetaPixelLoaded?: boolean;
    __tshMetaConsentGranted?: boolean;
  }
}

export function isMetaPixelConfigured(): boolean {
  return META_PIXEL_ID.length > 0;
}

export function isMetaConsentGranted(): boolean {
  return typeof window !== 'undefined' && window.__tshMetaConsentGranted === true;
}

export function generateMetaEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `meta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function bootstrapFbq(): void {
  if (window.fbq) return;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue?.push(args);
    }
  } as Fbq;

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];

  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
}

export function loadMetaPixel(): void {
  if (typeof window === 'undefined' || !isMetaPixelConfigured()) return;

  if (!window.__tshMetaPixelLoaded) {
    bootstrapFbq();
    window.fbq?.('consent', 'grant');
    window.fbq?.('init', META_PIXEL_ID);
    window.__tshMetaPixelLoaded = true;
  } else {
    window.fbq?.('consent', 'grant');
  }

  window.__tshMetaConsentGranted = true;
}

export function revokeMetaConsent(): void {
  if (typeof window === 'undefined') return;
  window.__tshMetaConsentGranted = false;
  if (window.__tshMetaPixelLoaded) {
    window.fbq?.('consent', 'revoke');
  }
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function sanitizeProperties(properties: MetaEventProperties): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  const contentIds = properties.content_ids
    ?.filter((id) => typeof id === 'string' && id.trim().length > 0)
    .slice(0, 100)
    .map((id) => id.trim().slice(0, 128));
  if (contentIds?.length) clean.content_ids = contentIds;

  const contents = properties.contents
    ?.filter(
      (item) =>
        typeof item?.id === 'string' &&
        item.id.trim().length > 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    )
    .slice(0, 100)
    .map((item) => ({
      id: item.id.trim().slice(0, 128),
      quantity: Math.max(1, Math.trunc(item.quantity)),
      ...(finiteNonNegative(item.item_price) !== undefined
        ? { item_price: finiteNonNegative(item.item_price) }
        : {}),
    }));
  if (contents?.length) clean.contents = contents;

  if (properties.content_type === 'product') {
    clean.content_type = 'product';
  }
  if (properties.content_name?.trim()) {
    clean.content_name = properties.content_name.trim().slice(0, 512);
  }
  if (properties.content_category?.trim()) {
    clean.content_category = properties.content_category.trim().slice(0, 256);
  }
  if (properties.currency && /^[A-Za-z]{3}$/.test(properties.currency)) {
    clean.currency = properties.currency.toUpperCase();
  }

  const value = finiteNonNegative(properties.value);
  if (value !== undefined) clean.value = value;

  if (
    typeof properties.num_items === 'number' &&
    Number.isFinite(properties.num_items) &&
    properties.num_items >= 0
  ) {
    clean.num_items = Math.trunc(properties.num_items);
  }

  return clean;
}

function queueServerEvent(
  eventName: Exclude<MetaEventName, 'Purchase'>,
  eventId: string,
  customData: Record<string, unknown>
): void {
  if (!META_CAPI_BROWSER_BRIDGE_ENABLED) return;

  void fetch('/api/analytics/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify({
      consent: true,
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      customData,
    }),
  }).catch(() => undefined);
}

export function trackMetaEvent(
  name: MetaEventName,
  properties: MetaEventProperties = {},
  options: MetaTrackOptions = {}
): string | null {
  if (
    typeof window === 'undefined' ||
    !window.__tshMetaPixelLoaded ||
    !window.__tshMetaConsentGranted
  ) {
    return null;
  }

  const eventId = options.eventId || generateMetaEventId();
  const customData = sanitizeProperties(properties);
  window.fbq?.('track', name, customData, { eventID: eventId });

  if (name !== 'Purchase' && options.sendServer !== false) {
    queueServerEvent(name, eventId, customData);
  }

  return eventId;
}

export function trackMetaPageView(): string | null {
  return trackMetaEvent('PageView');
}
