import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isMetaCapiConfigured, sendMetaServerEvent } from '@/lib/analytics/meta-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const publicEventSchema = z.object({
  consent: z.literal(true),
  eventName: z.enum(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout']),
  eventId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  eventSourceUrl: z.string().url(),
  customData: z
    .object({
      content_ids: z.array(z.string().min(1).max(128)).max(100).optional(),
      contents: z
        .array(
          z.object({
            id: z.string().min(1).max(128),
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
});

interface RateEntry {
  count: number;
  resetAt: number;
}

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;
const rateStore = new Map<string, RateEntry>();

function clientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return request.headers.get('x-real-ip')?.trim() || undefined;
}

function rateLimit(key: string): boolean {
  const now = Date.now();
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;

  if (rateStore.size > 2_000) {
    for (const [storedKey, entry] of rateStore) {
      if (entry.resetAt <= now) rateStore.delete(storedKey);
    }
  }
  return true;
}

function allowedTshUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (process.env.NODE_ENV !== 'production') {
      return (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === 'tsh.sale' ||
        url.hostname === 'www.tsh.sale'
      );
    }
    return (
      url.protocol === 'https:' && (url.hostname === 'tsh.sale' || url.hostname === 'www.tsh.sale')
    );
  } catch {
    return false;
  }
}

function sameSiteOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return allowedTshUrl(origin);
}

export async function POST(request: NextRequest) {
  if (!sameSiteOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = clientIp(request);
  if (!rateLimit(ip || 'unknown')) {
    return NextResponse.json({ error: 'Too many measurement requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = publicEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid measurement event' }, { status: 400 });
  }

  if (!allowedTshUrl(parsed.data.eventSourceUrl)) {
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
      eventSourceUrl: parsed.data.eventSourceUrl,
      customData: parsed.data.customData,
      clientIp: ip,
      clientUserAgent: userAgent,
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
