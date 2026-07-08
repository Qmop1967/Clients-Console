import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  type VerifyAuthenticationResponseOpts,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { Redis } from '@upstash/redis';
import { getCustomerByEmail } from '@/lib/odoo/customers';
import { issueAuthTicket, issueRecoveryToken, type AuthSubject } from '@/lib/auth-tickets';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const rpID = process.env.NEXTAUTH_URL?.includes('localhost')
  ? 'localhost'
  : 'tsh.sale';
const origin = process.env.NEXTAUTH_URL || 'https://www.tsh.sale';

export async function POST(request: NextRequest) {
  try {
    const { email, credential } = await request.json();

    if (!email || !credential) {
      return NextResponse.json(
        { error: 'Email and credential are required' },
        { status: 400 }
      );
    }

    // Get expected challenge
    const challengeKey = `webauthn:auth-challenge:${email}`;
    const expectedChallenge = await redis.get<string>(challengeKey);

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Challenge expired or not found' },
        { status: 400 }
      );
    }

    // Get user's authenticators
    const authenticatorsKey = `webauthn:authenticators:${email}`;
    const authenticators = (await redis.get<Array<any>>(authenticatorsKey)) || [];

    // Find the authenticator
    const credentialIDBase64 = Buffer.from(credential.id, 'base64url').toString('base64');
    const authenticator = authenticators.find(
      (auth: any) => auth.credentialID === credentialIDBase64
    );

    if (!authenticator) {
      return NextResponse.json(
        { error: 'Authenticator not found' },
        { status: 404 }
      );
    }

    // Verify authentication
    const opts: VerifyAuthenticationResponseOpts = {
      response: credential as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credentialID, // Base64 encoded string
        publicKey: Uint8Array.from(Buffer.from(authenticator.credentialPublicKey, 'base64')),
        counter: authenticator.counter,
      },
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 400 }
      );
    }

    // Delete challenge
    await redis.del(challengeKey);

    // Update authenticator counter
    authenticator.counter = verification.authenticationInfo.newCounter;
    await redis.set(authenticatorsKey, authenticators);

    // SECURITY 2026-07-02: passkey assertion verified server-side. Instead of
    // minting a session directly (the JWT strategy ignores adapter sessions),
    // hand back a single-use auth ticket + rotating recovery token — exactly the
    // contract otp/verify uses. The client feeds the ticket to the NextAuth
    // `email` Credentials provider via signIn(). The ticket carries the
    // authoritative identity; a passkey alone can no longer forge a session.
    const cleanEmail = String(email).trim().toLowerCase();
    const customer = await getCustomerByEmail(cleanEmail);
    if (!customer) {
      console.warn('[WebAuthn Auth] No customer for passkey email:', cleanEmail);
      return NextResponse.json(
        { error: 'No account found for this email' },
        { status: 404 }
      );
    }
    const partnerId = Number(customer.contact_id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
    }

    const subject: AuthSubject = { method: 'email', email: cleanEmail, partnerId };
    const ticket = await issueAuthTicket(subject);
    const recoveryToken = await issueRecoveryToken(subject);

    console.log('[WebAuthn Auth] ✅ Passkey verified, ticket issued for:', cleanEmail);

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
    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}
