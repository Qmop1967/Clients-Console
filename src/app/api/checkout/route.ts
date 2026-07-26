import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { createSalesOrder } from '@/lib/odoo/orders';
import { z } from 'zod';
import crypto from 'crypto';
import {
  isMetaCapiConfigured,
  sendMetaServerEvent,
} from '@/lib/analytics/meta-server';

export const maxDuration = 60;

// ============================================
// Idempotency Key Protection
// ============================================
interface IdempotencyEntry {
  response: any;
  status: number;
  createdAt: number;
}

const idempotencyStore = new Map<string, IdempotencyEntry>();
const IDEMPOTENCY_TTL = 120_000; // 120 seconds — sliding window

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL) {
      idempotencyStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

function generateIdempotencyKey(partnerId: string | number, items: any[]): string {
  // No time window in key — TTL-based sliding window prevents boundary-crossing duplicates
  const itemsHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(items.map(i => ({ id: i.item_id, qty: i.quantity, rate: i.rate })).sort((a, b) => a.id.localeCompare(b.id))))
    .digest('hex')
    .slice(0, 16);
  return `checkout:${partnerId}:${itemsHash}`;
}

function allowedTshEventUrl(value: string): boolean {
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
      url.protocol === 'https:' &&
      (url.hostname === 'tsh.sale' || url.hostname === 'www.tsh.sale')
    );
  } catch {
    return false;
  }
}

function requestClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return request.headers.get('x-real-ip')?.trim() || undefined;
}

const checkoutSchema = z.object({
  items: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().positive(),
    rate: z.number().positive(),
    name: z.string(),
    sku: z.string(),
  })),
  notes: z.string().optional(),
  orderType: z.enum(['bulk', 'delivery']).optional(), // Phase 3: bulk=نقليات، delivery=توصيل COD
  idempotencyKey: z.string().optional(),
  meta: z.object({
    consent: z.literal(true),
    event_id: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
    event_source_url: z.string().url().refine(allowedTshEventUrl),
  }).strict().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.odooPartnerId) {
      return NextResponse.json(
        { error: 'Authentication required. Please login to place an order.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { items, notes, orderType, meta } = validation.data;

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items in cart' }, { status: 400 });
    }

    // Resolve idempotency key: header > body > auto-generate
    const idempotencyKey =
      request.headers.get('Idempotency-Key') ||
      body.idempotencyKey ||
      generateIdempotencyKey(session.user.odooPartnerId, items);

    // Check for existing response
    const existing = idempotencyStore.get(idempotencyKey);
    if (existing && Date.now() - existing.createdAt < IDEMPOTENCY_TTL) {
      console.log(`[Checkout] Idempotent hit: ${idempotencyKey}`);
      return NextResponse.json(existing.response, { status: existing.status });
    }

    const lineItems = items.map(item => ({
      item_id: item.item_id,
      quantity: item.quantity,
      rate: item.rate,
    }));

    console.log(`[Checkout] Creating order for customer ${session.user.odooPartnerId} (key: ${idempotencyKey})`);

    const result = await createSalesOrder({
      customer_id: session.user.odooPartnerId,
      line_items: lineItems,
      notes: notes || `Order placed via TSH Web Portal`,
      order_type: orderType === 'bulk' ? 'transport' : orderType === 'delivery' ? 'delivery' : undefined,
      idempotencyKey,
    });

    if (!result.success || !result.order) {
      console.error('[Checkout] Failed:', result.error);
      const errorResp = { error: result.error || 'Failed to create order. Please try again.' };
      return NextResponse.json(errorResp, { status: 500 });
    }

    const order = result.order;
    console.log(`[Checkout] Order created: ${order.salesorder_number}`);

    // Purchase is server-trusted: it is emitted only after the gateway confirms
    // the real Odoo sale order. A CAPI failure can never fail or duplicate the
    // customer's order.
    if (meta?.consent && isMetaCapiConfigured()) {
      const userAgent = request.headers.get('user-agent')?.trim();
      if (userAgent) {
        try {
          await sendMetaServerEvent({
            eventName: 'Purchase',
            eventId: meta.event_id,
            eventSourceUrl: meta.event_source_url,
            clientIp: requestClientIp(request),
            clientUserAgent: userAgent,
            fbp: request.cookies.get('_fbp')?.value,
            fbc: request.cookies.get('_fbc')?.value,
            customData: {
              content_ids: items.map((item) => item.sku),
              contents: items.map((item) => ({
                id: item.sku,
                quantity: item.quantity,
                item_price: item.rate,
              })),
              content_type: 'product',
              currency: order.currency_code || 'IQD',
              value: Number(order.total),
              num_items: items.reduce(
                (total, item) => total + item.quantity,
                0,
              ),
            },
          });
        } catch {
          console.error(
            '[Checkout] Meta CAPI Purchase delivery failed safely',
          );
        }
      }
    }

    const successResp = {
      success: true,
      order: {
        salesorder_id: order.salesorder_id,
        salesorder_number: order.salesorder_number,
        total: order.total,
        status: order.status,
        date: order.date,
      },
    };

    // Store idempotency response
    idempotencyStore.set(idempotencyKey, {
      response: successResp,
      status: 200,
      createdAt: Date.now(),
    });

    return NextResponse.json(successResp);
  } catch (error) {
    console.error('[Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process your order. Please try again.' },
      { status: 500 }
    );
  }
}
