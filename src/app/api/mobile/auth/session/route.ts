// ============================================
// Mobile Auth: Session Management
// GET /api/mobile/auth/session - Validate session & get user info
// POST /api/mobile/auth/session - Refresh tokens
// DELETE /api/mobile/auth/session - Logout
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  extractBearerToken,
  verifyToken,
  verifyRefreshToken,
  generateTokenPair,
  revokeRefreshToken,
  MobileUser,
} from '@/lib/auth/mobile-jwt';
import { getZohoCustomerFresh } from '@/lib/zoho/customers';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// GET: Validate current session and return user info
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_TOKEN',
            message: 'Authorization token required',
            message_ar: 'رمز التفويض مطلوب',
          },
        },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);

    if (!payload || payload.type !== 'access') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            message_ar: 'رمز غير صالح أو منتهي الصلاحية',
          },
        },
        { status: 401 }
      );
    }

    // Optionally refresh user data from Zoho
    let user: MobileUser = {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      zohoContactId: payload.zohoContactId,
      priceListId: payload.priceListId,
      currencyCode: payload.currencyCode,
    };

    // Get fresh data from Zoho if requested
    const refreshData = request.nextUrl.searchParams.get('refresh') === 'true';
    if (refreshData && payload.zohoContactId) {
      const customer = await getZohoCustomerFresh(payload.zohoContactId);
      if (customer) {
        user = {
          ...user,
          name: customer.contact_name,
          priceListId: customer.pricebook_id || customer.price_list_id || user.priceListId,
          currencyCode: customer.currency_code || user.currencyCode,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        expiresAt: payload.exp,
      },
    });

  } catch (error) {
    console.error('[Mobile Session GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to validate session',
          message_ar: 'فشل التحقق من الجلسة',
        },
      },
      { status: 500 }
    );
  }
}

// Refresh token schema
const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST: Refresh tokens using refresh token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = refreshSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Refresh token is required',
            message_ar: 'رمز التحديث مطلوب',
          },
        },
        { status: 400 }
      );
    }

    const { refreshToken } = validation.data;

    // Verify refresh token
    const payload = await verifyToken(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token',
            message_ar: 'رمز التحديث غير صالح',
          },
        },
        { status: 401 }
      );
    }

    // Verify token is still valid in Redis
    const isValid = await verifyRefreshToken(refreshToken, payload.userId);

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Session has been revoked. Please login again.',
            message_ar: 'تم إلغاء الجلسة. يرجى تسجيل الدخول مرة أخرى.',
          },
        },
        { status: 401 }
      );
    }

    // Get user data from Redis
    const userJson = await redis.get<string>(`mobile:user:${payload.userId}`);
    if (!userJson) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User session not found. Please login again.',
            message_ar: 'لم يتم العثور على جلسة المستخدم. يرجى تسجيل الدخول مرة أخرى.',
          },
        },
        { status: 401 }
      );
    }

    const user: MobileUser = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;

    // Generate new token pair
    const tokens = await generateTokenPair(user);

    console.log(`[Mobile Session] Tokens refreshed for: ${user.email}`);

    return NextResponse.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user,
      },
    });

  } catch (error) {
    console.error('[Mobile Session POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to refresh tokens',
          message_ar: 'فشل تحديث الرموز',
        },
      },
      { status: 500 }
    );
  }
}

// DELETE: Logout - revoke refresh token
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      // Already logged out, return success
      return NextResponse.json({
        success: true,
        data: {
          message: 'Logged out successfully',
          message_ar: 'تم تسجيل الخروج بنجاح',
        },
      });
    }

    const payload = await verifyToken(token);

    if (payload) {
      // Revoke the refresh token
      await revokeRefreshToken(payload.userId);
      // Delete user session data
      await redis.del(`mobile:user:${payload.userId}`);
    }

    console.log(`[Mobile Session] User logged out: ${payload?.email || 'unknown'}`);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Logged out successfully',
        message_ar: 'تم تسجيل الخروج بنجاح',
      },
    });

  } catch (error) {
    console.error('[Mobile Session DELETE] Error:', error);
    // Even on error, consider it logged out
    return NextResponse.json({
      success: true,
      data: {
        message: 'Logged out',
        message_ar: 'تم تسجيل الخروج',
      },
    });
  }
}
