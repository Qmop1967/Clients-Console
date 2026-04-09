import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  type GenerateAuthenticationOptionsOpts,
} from '@simplewebauthn/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const rpID = process.env.NEXTAUTH_URL?.includes('localhost')
  ? 'localhost'
  : 'tsh.sale';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user's existing authenticators
    const authenticatorsKey = `webauthn:authenticators:${email}`;
    const authenticators = (await redis.get<Array<any>>(authenticatorsKey)) || [];

    if (authenticators.length === 0) {
      return NextResponse.json(
        { error: 'No passkey registered for this email' },
        { status: 404 }
      );
    }

    const options: GenerateAuthenticationOptionsOpts = {
      rpID,
      allowCredentials: authenticators.map((auth: any) => ({
        id: auth.credentialID, // Already base64 encoded string
        transports: auth.transports,
      })),
      userVerification: 'preferred',
    };

    const authenticationOptions = await generateAuthenticationOptions(options);

    // Store challenge in Redis with 5 minute expiration
    const challengeKey = `webauthn:auth-challenge:${email}`;
    await redis.setex(challengeKey, 300, authenticationOptions.challenge);

    console.log('[WebAuthn Auth] Options generated for:', email);

    return NextResponse.json(authenticationOptions);
  } catch (error) {
    console.error('[WebAuthn Auth] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
