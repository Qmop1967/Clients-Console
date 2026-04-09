import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  type GenerateRegistrationOptionsOpts,
} from '@simplewebauthn/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const rpName = 'TSH Clients Console';
const rpID = process.env.NEXTAUTH_URL?.includes('localhost')
  ? 'localhost'
  : 'tsh.sale';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user's existing authenticators (if any)
    const authenticatorsKey = `webauthn:authenticators:${email}`;
    const existingAuthenticators = (await redis.get<Array<any>>(authenticatorsKey)) || [];

    const options: GenerateRegistrationOptionsOpts = {
      rpName,
      rpID,
      userName: email,
      userDisplayName: email.split('@')[0],
      attestationType: 'none',
      excludeCredentials: existingAuthenticators.map((auth: any) => ({
        id: auth.credentialID, // Already base64 encoded string
        transports: auth.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Prefer platform authenticators (Face ID, Touch ID)
      },
    };

    const registrationOptions = await generateRegistrationOptions(options);

    // Store challenge in Redis with 5 minute expiration
    const challengeKey = `webauthn:challenge:${email}`;
    await redis.setex(challengeKey, 300, registrationOptions.challenge);

    console.log('[WebAuthn Register] Options generated for:', email);

    return NextResponse.json(registrationOptions);
  } catch (error) {
    console.error('[WebAuthn Register] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
