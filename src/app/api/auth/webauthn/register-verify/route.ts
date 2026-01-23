import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  type VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import { Redis } from '@upstash/redis';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';

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
    const challengeKey = `webauthn:challenge:${email}`;
    const expectedChallenge = await redis.get<string>(challengeKey);

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Challenge expired or not found' },
        { status: 400 }
      );
    }

    // Verify registration
    const opts: VerifyRegistrationResponseOpts = {
      response: credential as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    // Delete challenge
    await redis.del(challengeKey);

    // Store authenticator
    const { credential: credentialData } = verification.registrationInfo;
    const authenticator = {
      credentialID: Buffer.from(credentialData.id).toString('base64'),
      credentialPublicKey: Buffer.from(credentialData.publicKey).toString('base64'),
      counter: credentialData.counter,
      transports: credential.response.transports || [],
      createdAt: new Date().toISOString(),
    };

    // Add to user's authenticators
    const authenticatorsKey = `webauthn:authenticators:${email}`;
    const existingAuthenticators = (await redis.get<Array<any>>(authenticatorsKey)) || [];
    existingAuthenticators.push(authenticator);
    await redis.set(authenticatorsKey, existingAuthenticators);

    console.log('[WebAuthn Register] Authenticator registered for:', email);

    return NextResponse.json({
      success: true,
      verified: true,
    });
  } catch (error) {
    console.error('[WebAuthn Register Verify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify registration' },
      { status: 500 }
    );
  }
}
