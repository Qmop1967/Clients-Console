import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createMetaMeasurementConsentReceipt,
  hasValidMetaMeasurementConsent,
  isMetaConsentVerificationConfigured,
  META_MEASUREMENT_CONSENT_COOKIE,
  META_MEASUREMENT_CONSENT_MAX_AGE_SECONDS,
} from '@/lib/analytics/meta-consent';
import { isAllowedTshOrigin } from '@/lib/analytics/meta-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consentSchema = z.object({ status: z.enum(['accepted', 'rejected']) }).strict();

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedTshOrigin(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid consent decision' }, { status: 400 });
  }

  const response = NextResponse.json({ saved: true });
  const cookieBase = {
    name: META_MEASUREMENT_CONSENT_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  if (parsed.data.status === 'rejected') {
    response.cookies.set({
      ...cookieBase,
      value: '',
      maxAge: 0,
    });
    return response;
  }

  if (!isMetaConsentVerificationConfigured()) {
    return NextResponse.json({ error: 'Measurement consent service unavailable' }, { status: 503 });
  }

  const existingReceipt = request.cookies.get(META_MEASUREMENT_CONSENT_COOKIE)?.value;
  response.cookies.set({
    ...cookieBase,
    value:
      existingReceipt && hasValidMetaMeasurementConsent(existingReceipt)
        ? existingReceipt
        : createMetaMeasurementConsentReceipt(),
    maxAge: META_MEASUREMENT_CONSENT_MAX_AGE_SECONDS,
  });
  return response;
}
