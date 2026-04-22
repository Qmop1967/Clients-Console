import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

/**
 * POST /api/push/register
 *
 * Proxies an FCM token registration to the central API gateway
 * (/api/push/register on port 3010), attaching the gateway API key
 * server-side so the browser never sees it.
 *
 * Enforces authentication: the request must carry a valid NextAuth
 * session, and the userId passed in the body is validated against
 * the session's Odoo partner id.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { token, app, userId } = body || {};

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'token مطلوب' },
        { status: 400 }
      );
    }

    // Derive a safe userId: prefer the session's Odoo partner id.
    // Reject body.userId if it doesn't match what the session says.
    const sessionUserId = Number(
      session.user.odooPartnerId || session.user.id || 0
    );
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'معرّف العميل غير متوفر' },
        { status: 400 }
      );
    }
    if (userId && Number(userId) !== sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'معرّف غير متطابق' },
        { status: 403 }
      );
    }

    const gatewayUrl = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
    const apiKey = process.env.API_KEY || process.env.GATEWAY_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'خطأ في الإعدادات' },
        { status: 500 }
      );
    }

    const res = await fetch(`${gatewayUrl}/api/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-user-id': String(sessionUserId),
      },
      body: JSON.stringify({
        token,
        app: app || 'clients',
        userId: sessionUserId,
        deviceInfo: req.headers.get('user-agent') || '',
      }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[push/register] proxy failed:', err);
    return NextResponse.json(
      { success: false, error: 'فشل تسجيل الإشعارات' },
      { status: 500 }
    );
  }
}
