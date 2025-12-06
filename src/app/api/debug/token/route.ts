// DEBUG: Test Zoho token refresh
// Protected by DEBUG_API_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { validateDebugAuth } from '@/lib/auth/debug-auth';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';

export async function GET(request: NextRequest) {
  // Require authentication
  const authError = validateDebugAuth(request);
  if (authError) return authError;

  try {
    // Check environment variables
    const envCheck = {
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_REFRESH_TOKEN_LENGTH: process.env.ZOHO_REFRESH_TOKEN?.length || 0,
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_ORGANIZATION_ID: process.env.ZOHO_ORGANIZATION_ID,
    };

    console.log('🔍 Environment check:', envCheck);

    if (!envCheck.ZOHO_REFRESH_TOKEN || !envCheck.ZOHO_CLIENT_ID || !envCheck.ZOHO_CLIENT_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        envCheck,
      });
    }

    // Try to refresh the token
    const params = new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    });

    console.log('🔄 Attempting token refresh...');

    const response = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const responseText = await response.text();
    console.log('📥 Token response status:', response.status);
    console.log('📥 Token response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse response',
        status: response.status,
        responseText,
        envCheck,
      });
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Token refresh failed',
        status: response.status,
        zohoError: data,
        envCheck,
      });
    }

    if (!data.access_token) {
      return NextResponse.json({
        success: false,
        error: 'No access_token in response',
        data,
        envCheck,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Token refresh successful',
      hasAccessToken: true,
      tokenLength: data.access_token.length,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      envCheck,
    });
  } catch (error) {
    console.error('❌ Token test error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: (error as Error).stack,
    }, { status: 500 });
  }
}
