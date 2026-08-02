import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isMetaPurchaseOutboxConfigured,
  retryMetaPurchaseOutbox,
} from '@/lib/analytics/meta-purchase-outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({ limit: z.number().int().min(1).max(100).optional() }).strict();

function authorized(request: NextRequest): boolean {
  const expected = process.env.META_CAPI_RETRY_SECRET || '';
  const authorization = request.headers.get('authorization') || '';
  const candidate = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (expected.length < 32 || candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isMetaPurchaseOutboxConfigured()) {
    return NextResponse.json({ error: 'Outbox unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid retry request' }, { status: 400 });
  }

  try {
    const result = await retryMetaPurchaseOutbox(parsed.data.limit);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    console.error('[Meta CAPI] Purchase outbox retry failed safely');
    return NextResponse.json({ error: 'Retry unavailable' }, { status: 503 });
  }
}
