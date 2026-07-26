import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isMetaCapiConfigured, sendMetaServerEvent } from '@/lib/analytics/meta-server';
import {
  hasValidMetaCapiTestSession,
  hasValidMetaMeasurementConsent,
  META_CAPI_TEST_SESSION_COOKIE,
  META_MEASUREMENT_CONSENT_COOKIE,
} from '@/lib/analytics/meta-consent';
import { isAllowedTshOrigin, normalizeTshMeasurementUrl } from '@/lib/analytics/meta-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const publicEventSchema = z
  .object({
    consent: z.literal(true),
    eventName: z.enum(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout']),
    eventId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
    eventSourceUrl: z.string().url().max(2048),
    customData: z
      .object({
        content_ids: z.array(z.string().min(1).max(100)).max(100).optional(),
        contents: z
          .array(
            z.object({
              id: z.string().min(1).max(100),
              quantity: z.number().int().positive(),
              item_price: z.number().nonnegative().optional(),
            })
          )
          .max(100)
          .optional(),
        content_type: z.literal('product').optional(),
        content_name: z.string().max(512).optional(),
        content_category: z.string().max(256).optional(),
        currency: z
          .string()
          .regex(/^[A-Za-z]{3}$/)
          .optional(),
        value: z.number().nonnegative().optional(),
        num_items: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

interface RateEntry {
  count: number;
  resetAt: number;
}

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;
const rateStore = new Map<string, RateEntry>();

function receiptRateKey(consentReceipt: string): string {
  return `receipt:${createHash('sha256').update(consentReceipt).digest('hex')}`;
}

function rateLimit(key: string, limit = RATE_LIMIT): boolean {
  const now = Date.now();
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;

  if (rateStore.size > 2_000) {
    for (const [storedKey, entry] of rateStore) {
      if (entry.resetAt <= now) rateStore.delete(storedKey);
    }
  }
  return true;
}

function sameSiteOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin && isAllowedTshOrigin(origin));
}

export async function POST(request: NextRequest) {
  if (!sameSiteOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const consentReceipt = request.cookies.get(META_MEASUREMENT_CONSENT_COOKIE)?.value;
  if (!consentReceipt || !hasValidMetaMeasurementConsent(consentReceipt)) {
    return NextResponse.json({ error: 'Measurement consent required' }, { status: 403 });
  }

  if (!rateLimit('global', 2_000) || !rateLimit(receiptRateKey(consentReceipt))) {
    return NextResponse.json({ error: 'Too many measurement requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = publicEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid measurement event' }, { status: 400 });
  }

  const eventSourceUrl = normalizeTshMeasurementUrl(parsed.data.eventSourceUrl);
  if (!eventSourceUrl) {
    return NextResponse.json({ error: 'Invalid event source' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent')?.trim();
  if (!userAgent) {
    return NextResponse.json({ error: 'Missing user agent' }, { status: 400 });
  }

  if (!isMetaCapiConfigured()) {
    return NextResponse.json({ accepted: false, reason: 'capi_not_configured' }, { status: 202 });
  }

  try {
    const result = await sendMetaServerEvent({
      eventName: parsed.data.eventName,
      eventId: parsed.data.eventId,
      eventSourceUrl,
      customData: parsed.data.customData,
      clientIp: undefined,
      clientUserAgent: userAgent,
      testSessionAuthorized: hasValidMetaCapiTestSession(
        request.cookies.get(META_CAPI_TEST_SESSION_COOKIE)?.value
      ),
      fbp: request.cookies.get('_fbp')?.value,
      fbc: request.cookies.get('_fbc')?.value,
    });

    return NextResponse.json({
      accepted: result.sent,
      eventsReceived: result.eventsReceived,
    });
  } catch {
    console.error('[Meta CAPI] Anonymous event delivery failed safely');
    return NextResponse.json({ error: 'Measurement delivery unavailable' }, { status: 502 });
  }
}
