import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  type VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { auth } from '@/lib/auth/auth';
import { consumeWebAuthnChallenge } from '@/lib/auth-tickets';
import { getPartnerPasskeys, savePartnerPasskeys, type PasskeyRecord } from '@/lib/odoo/passkeys';

const rpID = process.env.NEXTAUTH_URL?.includes('localhost') ? 'localhost' : 'tsh.sale';
const origin = process.env.NEXTAUTH_URL || 'https://www.tsh.sale';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const partnerId = Number(session?.user?.odooPartnerId || session?.user?.id || 0);
    if (!session?.user || !Number.isInteger(partnerId) || partnerId <= 0) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { response, challengeToken, deviceName } = await request.json();
    if (!response || !challengeToken) {
      return NextResponse.json({ error: 'response and challengeToken are required' }, { status: 400 });
    }

    const consumed = consumeWebAuthnChallenge(challengeToken, 'wa-reg');
    if (!consumed) {
      return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });
    }
    // The ceremony must belong to the same partner that is logged in.
    if (consumed.partnerId !== partnerId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const opts: VerifyRegistrationResponseOpts = {
      response: response as RegistrationResponseJSON,
      expectedChallenge: consumed.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    };

    const verification = await verifyRegistrationResponse(opts);
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const newRecord: PasskeyRecord = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: (response as RegistrationResponseJSON).response?.transports || [],
      deviceName: typeof deviceName === 'string' && deviceName.trim() ? deviceName.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    // Full-replace store → read, dedupe by id, append, write back.
    const existing = await getPartnerPasskeys(partnerId);
    const deduped = existing.filter((p) => p.id !== newRecord.id);
    deduped.push(newRecord);
    await savePartnerPasskeys(partnerId, deduped);

    console.log('[WebAuthn Register] Passkey stored for partner:', partnerId);
    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    console.error('[WebAuthn Register Verify] Error:', error);
    return NextResponse.json({ error: 'store_unavailable' }, { status: 503 });
  }
}
