import 'server-only';
import { isIP } from 'node:net';
import { isMetaConsentVerificationConfigured } from '@/lib/analytics/meta-consent';
import { normalizeTshMeasurementUrl } from '@/lib/analytics/meta-policy';

/**
 * Server-only Meta Conversions API sender.
 *
 * The access token is read only from a protected server environment variable.
 * No token or raw Meta error body is ever logged or returned to callers.
 */

export type MetaServerEventName =
  'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

export interface MetaServerCustomData {
  content_ids?: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  content_type?: 'product';
  content_name?: string;
  content_category?: string;
  currency?: string;
  value?: number;
  num_items?: number;
}

export interface MetaServerEventInput {
  eventName: MetaServerEventName;
  eventId: string;
  eventSourceUrl: string;
  customData?: MetaServerCustomData;
  clientIp?: string;
  clientUserAgent: string;
  fbp?: string;
  fbc?: string;
  testSessionAuthorized?: boolean;
}

export interface MetaServerEventResult {
  configured: boolean;
  sent: boolean;
  eventsReceived?: number;
}

const PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || '';
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE || '';
const RAW_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0';
const API_VERSION = /^v\d+\.\d+$/.test(RAW_API_VERSION) ? RAW_API_VERSION : 'v25.0';
const RAW_MODE = process.env.META_CAPI_MODE || 'disabled';
const MODE = RAW_MODE === 'test' || RAW_MODE === 'production' ? RAW_MODE : 'disabled';
const VALID_EVENT_NAMES = new Set<MetaServerEventName>([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
]);
const PRODUCTION_EVENTS = new Set<MetaServerEventName>(
  (process.env.META_CAPI_EVENTS || 'PageView,ViewContent')
    .split(',')
    .map((name) => name.trim())
    .filter((name): name is MetaServerEventName =>
      VALID_EVENT_NAMES.has(name as MetaServerEventName)
    )
);

export function isMetaCapiConfigured(): boolean {
  const baseConfigured =
    /^\d+$/.test(PIXEL_ID) && ACCESS_TOKEN.length > 0 && isMetaConsentVerificationConfigured();
  if (!baseConfigured) return false;
  if (MODE === 'test') return TEST_EVENT_CODE.length > 0;
  if (MODE === 'production') return TEST_EVENT_CODE.length === 0;
  return false;
}

export function canSendMetaServerEvent(
  eventName: MetaServerEventName,
  testSessionAuthorized = false
): boolean {
  if (!isMetaCapiConfigured()) return false;
  // Purchase requires a durable outbox/retry ledger before it can be sent
  // safely. Keep it hard-disabled even if an environment allowlist is edited.
  if (eventName === 'Purchase') {
    return false;
  }
  if (MODE === 'test') {
    return eventName === 'ViewContent' && testSessionAuthorized;
  }
  return MODE === 'production' && PRODUCTION_EVENTS.has(eventName);
}

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  const clean = value?.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function cleanBrowserId(value: string | undefined, kind: 'fbp' | 'fbc'): string | undefined {
  const clean = cleanText(value, 256);
  if (!clean) return undefined;
  const pattern =
    kind === 'fbp'
      ? /^fb\.[12]\.\d{10,13}\.[A-Za-z0-9._-]{1,160}$/
      : /^fb\.[12]\.\d{10,13}\.[A-Za-z0-9._-]{6,200}$/;
  return pattern.test(clean) ? clean : undefined;
}

function cleanCustomData(
  data: MetaServerCustomData | undefined
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const clean: Record<string, unknown> = {};

  const ids = data.content_ids
    ?.filter((id) => typeof id === 'string' && id.trim().length > 0)
    .slice(0, 100)
    .map((id) => id.trim().slice(0, 100));
  if (ids?.length) clean.content_ids = ids;

  const contents = data.contents
    ?.filter(
      (item) =>
        typeof item?.id === 'string' &&
        item.id.trim().length > 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    )
    .slice(0, 100)
    .map((item) => ({
      id: item.id.trim().slice(0, 100),
      quantity: Math.max(1, Math.trunc(item.quantity)),
      ...(typeof item.item_price === 'number' &&
      Number.isFinite(item.item_price) &&
      item.item_price >= 0
        ? { item_price: item.item_price }
        : {}),
    }));
  if (contents?.length) clean.contents = contents;

  if (data.content_type === 'product') clean.content_type = 'product';

  const contentName = cleanText(data.content_name, 512);
  if (contentName) clean.content_name = contentName;

  const contentCategory = cleanText(data.content_category, 256);
  if (contentCategory) clean.content_category = contentCategory;

  if (data.currency && /^[A-Za-z]{3}$/.test(data.currency)) {
    clean.currency = data.currency.toUpperCase();
  }
  if (typeof data.value === 'number' && Number.isFinite(data.value) && data.value >= 0) {
    clean.value = data.value;
  }
  if (
    typeof data.num_items === 'number' &&
    Number.isFinite(data.num_items) &&
    data.num_items >= 0
  ) {
    clean.num_items = Math.trunc(data.num_items);
  }

  return Object.keys(clean).length ? clean : undefined;
}

export async function sendMetaServerEvent(
  input: MetaServerEventInput
): Promise<MetaServerEventResult> {
  if (!isMetaCapiConfigured()) {
    return { configured: false, sent: false };
  }
  if (!canSendMetaServerEvent(input.eventName, input.testSessionAuthorized === true)) {
    return { configured: true, sent: false };
  }

  if (!/^[A-Za-z0-9_-]{8,128}$/.test(input.eventId)) {
    throw new Error('Invalid Meta event id');
  }

  const eventSourceUrl = normalizeTshMeasurementUrl(input.eventSourceUrl);
  if (!eventSourceUrl) {
    throw new Error('Invalid Meta event source URL');
  }

  const userData: Record<string, string> = {};
  const clientIp = cleanText(input.clientIp, 64);
  if (clientIp && isIP(clientIp)) userData.client_ip_address = clientIp;

  const userAgent = cleanText(input.clientUserAgent, 512);
  if (!userAgent) throw new Error('Client user agent is required');
  userData.client_user_agent = userAgent;

  const fbp = cleanBrowserId(input.fbp, 'fbp');
  if (fbp) userData.fbp = fbp;
  const fbc = cleanBrowserId(input.fbc, 'fbc');
  if (fbc) userData.fbc = fbc;

  const customData = cleanCustomData(input.customData);
  const event = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    event_source_url: eventSourceUrl,
    action_source: 'website',
    user_data: userData,
    ...(customData ? { custom_data: customData } : {}),
  };

  const payload: Record<string, unknown> = {
    data: [event],
    access_token: ACCESS_TOKEN,
  };
  if (MODE === 'test') {
    payload.test_event_code = TEST_EVENT_CODE;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = (await response.json().catch(() => ({}))) as {
      events_received?: number;
      error?: { code?: number; type?: string };
    };

    if (!response.ok || result.error) {
      const code = result.error?.code ? ` code ${result.error.code}` : '';
      throw new Error(`Meta CAPI rejected event (${response.status}${code})`);
    }

    return {
      configured: true,
      sent: true,
      eventsReceived: result.events_received,
    };
  } finally {
    clearTimeout(timeout);
  }
}
