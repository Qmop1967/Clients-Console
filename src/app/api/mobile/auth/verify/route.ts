// ============================================
// Mobile Auth: Verify OTP Code
// POST /api/mobile/auth/verify
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyOTPCode,
  generateTokenPair,
  MobileUser,
} from '@/lib/auth/mobile-jwt';
import { getZohoCustomerByEmail, getZohoCustomerFresh } from '@/lib/zoho/customers';
import { Redis } from '@upstash/redis';

// Initialize Redis for user storage
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Request schema
const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

// Demo account for Apple App Store review
const DEMO_EMAIL = 'demo@tsh.sale';
const DEMO_USER: MobileUser = {
  id: 'mobile:demo-user',
  email: DEMO_EMAIL,
  name: 'Demo User',
  zohoContactId: 'demo-contact-id',
  priceListId: '2646610000049149103', // Consumer price list (public prices)
  currencyCode: 'IQD',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Please enter a valid 6-digit code',
            message_ar: 'يرجى إدخال رمز صحيح مكون من 6 أرقام',
          },
        },
        { status: 400 }
      );
    }

    const { email, code } = validation.data;

    // Verify the OTP code
    const isValid = await verifyOTPCode(email, code);

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Invalid or expired verification code. Please try again.',
            message_ar: 'رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى المحاولة مرة أخرى.',
          },
        },
        { status: 400 }  // Use 400, not 401, so Swift client reads the error message
      );
    }

    // Handle demo account for Apple App Store review
    const emailLower = email.toLowerCase();
    if (emailLower === DEMO_EMAIL) {
      // Store demo user in Redis
      await redis.set(
        `mobile:user:${DEMO_USER.id}`,
        JSON.stringify(DEMO_USER),
        { ex: 30 * 24 * 60 * 60 } // 30 days
      );

      // Generate JWT token pair for demo user
      const tokens = await generateTokenPair(DEMO_USER);

      console.log(`[Mobile Verify] Demo account authenticated: ${emailLower}`);

      return NextResponse.json({
        success: true,
        data: {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + tokens.expiresIn,
          user: {
            id: DEMO_USER.id,
            email: DEMO_USER.email,
            name: DEMO_USER.name,
            company_name: 'Demo Company',
            zoho_contact_id: DEMO_USER.zohoContactId,
            price_list_id: DEMO_USER.priceListId,
            currency_code: DEMO_USER.currencyCode,
          },
        },
      });
    }

    // Get customer from Zoho
    const customerBasic = await getZohoCustomerByEmail(email);

    if (!customerBasic) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer account not found',
            message_ar: 'لم يتم العثور على حساب العميل',
          },
        },
        { status: 404 }
      );
    }

    // Fetch full customer details for price list info
    const customer = await getZohoCustomerFresh(customerBasic.contact_id) || customerBasic;

    // Create or get mobile user
    const userId = `mobile:${customer.contact_id}`;

    const mobileUser: MobileUser = {
      id: userId,
      email: customer.email || email,
      name: customer.contact_name,
      zohoContactId: customer.contact_id,
      priceListId: customer.pricebook_id || customer.price_list_id || '',
      currencyCode: customer.currency_code || 'IQD',
    };

    // Store user in Redis for later retrieval
    await redis.set(
      `mobile:user:${userId}`,
      JSON.stringify(mobileUser),
      { ex: 30 * 24 * 60 * 60 } // 30 days
    );

    // Generate JWT token pair
    const tokens = await generateTokenPair(mobileUser);

    console.log(`[Mobile Verify] User authenticated: ${email}`);

    // Return snake_case keys to match Swift Codable expectations
    return NextResponse.json({
      success: true,
      data: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expiresIn,
        user: {
          id: mobileUser.id,
          email: mobileUser.email,
          name: mobileUser.name,
          company_name: null,  // Not available from Zoho contact
          zoho_contact_id: mobileUser.zohoContactId,
          price_list_id: mobileUser.priceListId,
          currency_code: mobileUser.currencyCode,
        },
      },
    });

  } catch (error) {
    console.error('[Mobile Verify] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Verification failed. Please try again.',
          message_ar: 'فشل التحقق. يرجى المحاولة مرة أخرى.',
        },
      },
      { status: 500 }
    );
  }
}
