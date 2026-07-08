import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from '@simplewebauthn/types';
import {
  issueAuthTicket,
  issueRecoveryToken,
  consumeWebAuthnChallenge,
  type AuthSubject,
} from '@/lib/auth-tickets';
import { getPartnerPasskeys, savePartnerPasskeys } from '@/lib/odoo/passkeys';

const rpID = process.env.NEXTAUTH_URL?.includes('localhost') ? 'localhost' : 'tsh.sale';
const origin = process.env.NEXTAUTH_URL || 'https://www.tsh.sale';

export async function POST(request: NextRequest) {
  try {
    const { email, response, challengeToken } = await request.json();
    if (!email || !response || !challengeToken) {
      return NextResponse.json(
        { error: 'email, response and challengeToken are required' },
        { status: 400 }
      );
    }
    const cleanEmail = String(email).trim().toLowerCase();

    const consumed = consumeWebAuthnChallenge(challengeToken, 'wa-auth');
    if (!consumed) {
      return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 401 });
    }
    // The token binds the ceremony to an email; the client must present the same.
    if (consumed.email !== cleanEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const partnerId = consumed.partnerId;

    const records = await getPartnerPasskeys(partnerId);
    const record = records.find((p) => p.id === (response as AuthenticationResponseJSON).id);
    if (!record) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const opts: VerifyAuthenticationResponseOpts = {
      response: response as AuthenticationResponseJSON,
      expectedChallenge: consumed.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: record.id,
        publicKey: new Uint8Array(Buffer.from(record.publicKey, 'base64url')),
        counter: record.counter,
        transports: record.transports as AuthenticatorTransportFuture[] | undefined,
      },
    };

    const verification = await verifyAuthenticationResponse(opts);
    if (!verification.verified) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Cloned-authenticator detection: a real counter must strictly advance.
    // Authenticators that never increment always report 0 — allow that case.
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter > 0 && newCounter <= record.counter) {
      console.warn('[WebAuthn Auth] counter regression — possible cloned authenticator', { partnerId });
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    record.counter = newCounter;
    record.lastUsedAt = new Date().toISOString();
    await savePartnerPasskeys(partnerId, records);

    // SECURITY 2026-07-02: passkey assertion verified server-side. Hand back a
    // single-use auth ticket + rotating recovery token — the exact contract
    // otp/verify uses. The client feeds the ticket to the NextAuth `email`
    // Credentials provider via signIn(). A passkey alone can't forge a session.
    const subject: AuthSubject = { method: 'email', email: cleanEmail, partnerId };
    const ticket = await issueAuthTicket(subject);
    const recoveryToken = await issueRecoveryToken(subject);

    console.log('[WebAuthn Auth] ✅ Passkey verified, ticket issued for partner:', partnerId);

    return NextResponse.json({
      success: true,
      verified: true,
      ticket,
      recoveryToken,
      method: 'email',
      email: cleanEmail,
      partnerId,
    });
  } catch (error) {
    console.error('[WebAuthn Auth Verify] Error:', error);
    return NextResponse.json({ error: 'store_unavailable' }, { status: 503 });
  }
}
