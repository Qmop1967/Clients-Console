import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { UpstashRedisAdapter } from '@auth/upstash-redis-adapter';
import { getZohoCustomerByEmail, getZohoCustomerFresh } from '@/lib/zoho/customers';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const adapter = UpstashRedisAdapter(redis);

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase and trim) - MUST match send route
    const normalizedEmail = email.toLowerCase().trim();

    // Clean and normalize the code (remove spaces, trim)
    const cleanCode = String(code).trim().replace(/\s/g, '');

    // Get OTP from Redis using normalized email
    const otpKey = `otp:${normalizedEmail}`;
    const storedOTP = await redis.get<string>(otpKey);

    // Normalize stored OTP the same way as received code
    const cleanStoredOTP = storedOTP ? String(storedOTP).trim().replace(/\s/g, '') : null;

    console.log('[OTP Verify] Debug:', {
      email: normalizedEmail,
      receivedCode: cleanCode,
      receivedCodeLength: cleanCode.length,
      storedCode: storedOTP,
      cleanStoredOTP,
      cleanStoredOTPLength: cleanStoredOTP?.length,
      match: cleanStoredOTP === cleanCode,
      typeofReceived: typeof code,
      typeofStored: typeof storedOTP,
      redisKey: otpKey,
    });

    if (!cleanStoredOTP) {
      return NextResponse.json(
        { error: 'Verification code expired or not found' },
        { status: 400 }
      );
    }

    // Verify OTP with cleaned code (both normalized the same way)
    if (cleanStoredOTP !== cleanCode) {
      console.error('[OTP Verify] Code mismatch:', {
        stored: cleanStoredOTP,
        storedLength: cleanStoredOTP.length,
        received: cleanCode,
        receivedLength: cleanCode.length,
        charsStored: cleanStoredOTP.split('').map((c, i) => `[${i}]='${c}' (${c.charCodeAt(0)})`),
        charsReceived: cleanCode.split('').map((c, i) => `[${i}]='${c}' (${c.charCodeAt(0)})`),
      });
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Delete OTP after successful verification
    await redis.del(otpKey);

    // Find or create user
    let user = await adapter.getUserByEmail!(normalizedEmail);

    if (!user) {
      // Create new user
      user = await adapter.createUser!({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        emailVerified: new Date(),
        name: normalizedEmail.split('@')[0],
      });
    }

    // Fetch Zoho customer data
    try {
      const customerBasic = await getZohoCustomerByEmail(normalizedEmail);

      if (customerBasic) {
        const customerFull = await getZohoCustomerFresh(customerBasic.contact_id);
        const customer = customerFull || customerBasic;

        // Update user with Zoho data (via adapter's user table)
        if (user && user.id) {
          // Store Zoho data in user object (these will be available in session callback)
          const updatedUser = {
            ...user,
            zohoContactId: customer.contact_id,
            priceListId: customer.pricebook_id || customer.price_list_id || '',
            currencyCode: customer.currency_code || 'IQD',
            name: customer.contact_name,
          };

          // Update in database via Redis (manual update since adapter doesn't have updateUser)
          const userKey = `user:${user.id}`;
          await redis.set(userKey, updatedUser);
          const emailKey = `user:email:${normalizedEmail}`;
          await redis.set(emailKey, user.id);

          user = updatedUser as typeof user;
        }

        console.log('[OTP Verify] Customer data fetched:', {
          contactId: customer.contact_id,
          priceListId: customer.pricebook_id || customer.price_list_id,
        });
      }
    } catch (error) {
      console.error('[OTP Verify] Error fetching Zoho data:', error);
      // Continue with login even if Zoho fetch fails
    }

    // Create session
    const session = await adapter.createSession!({
      userId: user.id,
      sessionToken: crypto.randomUUID(),
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days
    });

    console.log('[OTP Verify] Session created for:', normalizedEmail);

    return NextResponse.json({
      success: true,
      sessionToken: session.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('[OTP Verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
