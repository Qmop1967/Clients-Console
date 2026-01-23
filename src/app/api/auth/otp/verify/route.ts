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

    // Get OTP from Redis
    const otpKey = `otp:${email}`;
    const storedOTP = await redis.get<string>(otpKey);

    if (!storedOTP) {
      return NextResponse.json(
        { error: 'Verification code expired or not found' },
        { status: 400 }
      );
    }

    // Verify OTP
    if (storedOTP !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Delete OTP after successful verification
    await redis.del(otpKey);

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
          const emailKey = `user:email:${email}`;
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

    console.log('[OTP Verify] Session created for:', email);

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
