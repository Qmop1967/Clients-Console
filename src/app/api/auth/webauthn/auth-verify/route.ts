import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { Redis } from '@upstash/redis';
import { UpstashRedisAdapter } from '@auth/upstash-redis-adapter';
import { getZohoCustomerByEmail, getZohoCustomerFresh } from '@/lib/zoho/customers';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const adapter = UpstashRedisAdapter(redis);

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
        id: Buffer.from(authenticator.credentialID, 'base64'),
        publicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
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

    // Find or create user
    let user = await adapter.getUserByEmail!(email);

    if (!user) {
      // Create new user
      user = await adapter.createUser!({
        id: crypto.randomUUID(),
        email,
        emailVerified: new Date(),
        name: email.split('@')[0],
      });
    }

    // Fetch Zoho customer data
    try {
      const customerBasic = await getZohoCustomerByEmail(email);

      if (customerBasic) {
        const customerFull = await getZohoCustomerFresh(customerBasic.contact_id);
        const customer = customerFull || customerBasic;

        // Update user with Zoho data
        if (user && user.id) {
          const updatedUser = {
            ...user,
            zohoContactId: customer.contact_id,
            priceListId: customer.pricebook_id || customer.price_list_id || '',
            currencyCode: customer.currency_code || 'IQD',
            name: customer.contact_name,
          };

          const userKey = `user:${user.id}`;
          await redis.set(userKey, updatedUser);
          const emailKey = `user:email:${email}`;
          await redis.set(emailKey, user.id);

          user = updatedUser as typeof user;
        }

        console.log('[WebAuthn Auth] Customer data fetched:', {
          contactId: customer.contact_id,
          priceListId: customer.pricebook_id || customer.price_list_id,
        });
      }
    } catch (error) {
      console.error('[WebAuthn Auth] Error fetching Zoho data:', error);
    }

    // Create session
    const session = await adapter.createSession!({
      userId: user.id,
      sessionToken: crypto.randomUUID(),
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days
    });

    console.log('[WebAuthn Auth] Session created for:', email);

    return NextResponse.json({
      success: true,
      verified: true,
      sessionToken: session.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('[WebAuthn Auth Verify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}
