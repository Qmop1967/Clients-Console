// ============================================
// Mobile Checkout API
// POST /api/mobile/cart/checkout
// ============================================

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

export const maxDuration = 60;
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { createSalesOrder } from '@/lib/odoo/orders';

// ============================================
// Idempotency Key Protection
// ============================================
interface IdempotencyEntry {
  response: any;
  createdAt: number;
  isError: boolean;
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

function generateIdempotencyKey(customerId: string | number, items: any[]): string {
  // No time window in key — TTL-based sliding window prevents boundary-crossing duplicates
  const itemsHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(items.map(i => ({ id: i.item_id, qty: i.quantity, rate: i.rate })).sort((a, b) => a.id.localeCompare(b.id))))
    .digest('hex')
    .slice(0, 16);
  return `mobile-checkout:${customerId}:${itemsHash}`;
}

const checkoutSchema = z.object({
  items: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().positive(),
    rate: z.number().positive(),
    name: z.string().optional(),
    sku: z.string().optional(),
  })),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireMobileAuth(request);
    if (isAuthError(authResult)) return authResult;
    const { user } = authResult;

    const customerId = (user as any).customerId || (user as any).odooPartnerId;
    if (!customerId) {
      return mobileError('NO_CUSTOMER', 'No customer account linked', 'لا يوجد حساب عميل مرتبط', 403);
    }

    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return mobileError('INVALID_DATA', 'Invalid request data', 'بيانات الطلب غير صالحة', 400);
    }

    const { items, notes } = validation.data;

    if (items.length === 0) {
      return mobileError('EMPTY_CART', 'Cart is empty', 'السلة فارغة', 400);
    }

    // Resolve idempotency key: header > body > auto-generate
    const idempotencyKey =
      request.headers.get('Idempotency-Key') ||
      body.idempotencyKey ||
      generateIdempotencyKey(customerId, items);

    // Check for existing response
    const existing = idempotencyStore.get(idempotencyKey);
    if (existing && Date.now() - existing.createdAt < IDEMPOTENCY_TTL) {
      console.log(`[Mobile Checkout] Idempotent hit: ${idempotencyKey}`);
      return existing.response;
    }

    const result = await createSalesOrder({
      customer_id: customerId,
      line_items: items.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        rate: item.rate,
      })),
      notes: notes || 'Order placed via TSH Mobile App',
    });

    if (!result.success || !result.order) {
      return mobileError('ORDER_FAILED', result.error || 'Failed to create order', 'فشل إنشاء الطلب', 500);
    }

    const successResp = mobileSuccess({
      order: {
        id: result.order.salesorder_id,
        number: result.order.salesorder_number,
        total: result.order.total,
        status: result.order.status,
        date: result.order.date,
      },
    });

    // Store idempotency response
    idempotencyStore.set(idempotencyKey, {
      response: successResp,
      createdAt: Date.now(),
      isError: false,
    });

    return successResp;
  } catch (error) {
    console.error('[Mobile Checkout] Error:', error);
    return mobileError('SERVER_ERROR', 'Checkout failed', 'فشل إتمام الطلب', 500);
  }
}
