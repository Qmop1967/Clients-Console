import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createMetaCapiTestSessionReceipt,
  metaCapiTestOperatorSecretMatches,
  META_CAPI_TEST_SESSION_COOKIE,
  META_CAPI_TEST_SESSION_MAX_AGE_SECONDS,
} from '@/lib/analytics/meta-consent';
import { isAllowedTshOrigin } from '@/lib/analytics/meta-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z
  .object({
    action: z.enum(['start', 'stop']),
    operatorSecret: z.string().min(32).max(512).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === 'start' && !value.operatorSecret) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['operatorSecret'],
        message: 'Operator secret is required',
      });
    }
  });

const ATTEMPT_WINDOW_MS = 60_000;
const ATTEMPT_LIMIT = 20;
let attemptWindow = { count: 0, resetAt: 0 };

function allowTestSessionAttempt(): boolean {
  const now = Date.now();
  if (attemptWindow.resetAt <= now) {
    attemptWindow = { count: 1, resetAt: now + ATTEMPT_WINDOW_MS };
    return true;
  }

  if (attemptWindow.count >= ATTEMPT_LIMIT) return false;
  attemptWindow.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedTshOrigin(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (parsed.data.action === 'start' && !allowTestSessionAttempt()) {
    return NextResponse.json({ error: 'Too many test-session attempts' }, { status: 429 });
  }

  const response = NextResponse.json({
    active: parsed.data.action === 'start',
  });
  const cookieBase = {
    name: META_CAPI_TEST_SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };

  if (parsed.data.action === 'stop') {
    response.cookies.set({ ...cookieBase, value: '', maxAge: 0 });
    return response;
  }

  if (
    process.env.META_CAPI_MODE !== 'test' ||
    !parsed.data.operatorSecret ||
    !metaCapiTestOperatorSecretMatches(parsed.data.operatorSecret)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  response.cookies.set({
    ...cookieBase,
    value: createMetaCapiTestSessionReceipt(),
    maxAge: META_CAPI_TEST_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
