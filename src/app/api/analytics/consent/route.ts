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
import { GEO_COUNTRY_HEADER, requiresPriorConsent } from '@/lib/analytics/consent-region';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `basis` says HOW the decision was reached:
 *   explicit — the visitor clicked Accept/Reject.
 *   implied  — legitimate interest, no click. Only honoured outside prior-consent regions.
 * Omitted defaults to `explicit`, so older clients keep their exact previous behaviour.
 */
const consentSchema = z
  .object({
    status: z.enum(['accepted', 'rejected']),
    basis: z.enum(['explicit', 'implied']).optional(),
  })
  .strict();

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

  // Region gate. The server decides, not the browser: a client claiming `implied`
  // from Frankfurt gets refused here even though it asked nicely.
  const basis = parsed.data.basis ?? 'explicit';
  if (
    basis === 'implied' &&
    parsed.data.status === 'accepted' &&
    requiresPriorConsent(request.headers.get(GEO_COUNTRY_HEADER))
  ) {
    // Not an error — a lawful refusal. The client falls back to the opt-in banner.
    return NextResponse.json({ saved: false, priorConsentRequired: true });
  }

  const response = NextResponse.json({ saved: true, basis });
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
