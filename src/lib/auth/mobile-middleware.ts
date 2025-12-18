// ============================================
// Mobile API Middleware Helpers
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyToken, MobileJWTPayload } from './mobile-jwt';

export interface MobileAuthContext {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    name?: string;
    zohoContactId: string;
    priceListId: string;
    currencyCode: string;
  } | null;
}

// Get mobile auth context from request
// Returns { isAuthenticated: false, user: null } for public access
// Returns { isAuthenticated: true, user: {...} } for authenticated users
export async function getMobileAuth(request: NextRequest): Promise<MobileAuthContext> {
  const authHeader = request.headers.get('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return { isAuthenticated: false, user: null };
  }

  const payload = await verifyToken(token);

  if (!payload || payload.type !== 'access') {
    return { isAuthenticated: false, user: null };
  }

  return {
    isAuthenticated: true,
    user: {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      zohoContactId: payload.zohoContactId,
      priceListId: payload.priceListId,
      currencyCode: payload.currencyCode,
    },
  };
}

// Require authentication - returns error response if not authenticated
export async function requireMobileAuth(
  request: NextRequest
): Promise<MobileAuthContext | NextResponse> {
  const auth = await getMobileAuth(request);

  if (!auth.isAuthenticated) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
          message_ar: 'تسجيل الدخول مطلوب',
        },
      },
      { status: 401 }
    );
  }

  return auth;
}

// Helper to check if response is an auth error
export function isAuthError(result: MobileAuthContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

// Standard mobile API error response
export function mobileError(
  code: string,
  message: string,
  messageAr: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        message_ar: messageAr,
      },
    },
    { status }
  );
}

// Standard mobile API success response
export function mobileSuccess<T>(data: T, meta?: object): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}
