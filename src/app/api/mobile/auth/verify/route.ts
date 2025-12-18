// ============================================
// Mobile Auth: Verify Magic Link Token
// POST /api/mobile/auth/verify
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyMobileVerificationToken,
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
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or missing verification token',
            message_ar: 'رمز التحقق غير صالح أو مفقود',
          },
        },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    // Verify the magic link token and get the email
    const email = await verifyMobileVerificationToken(token);

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'This link has expired or already been used. Please request a new one.',
            message_ar: 'انتهت صلاحية هذا الرابط أو تم استخدامه بالفعل. يرجى طلب رابط جديد.',
          },
        },
        { status: 401 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: mobileUser.id,
          email: mobileUser.email,
          name: mobileUser.name,
          zohoContactId: mobileUser.zohoContactId,
          priceListId: mobileUser.priceListId,
          currencyCode: mobileUser.currencyCode,
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
