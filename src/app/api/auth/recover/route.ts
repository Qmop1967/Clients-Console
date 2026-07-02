// ============================================
// Silent session recovery (iOS PWA cookie loss)
// ============================================
// SECURITY 2026-07-02. The client no longer stores the raw phone to silently
// re-login. Instead it holds a rotating recovery token. This endpoint validates
// + rotates that token and hands back a single-use auth ticket, which the
// client feeds to signIn(). A leaked token is single-use and expires (90d).
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { rotateRecoveryToken, issueAuthTicket } from '@/lib/auth-tickets';

export async function POST(request: NextRequest) {
  try {
    const { recoveryToken } = await request.json();
    if (!recoveryToken || typeof recoveryToken !== 'string') {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const rotated = await rotateRecoveryToken(recoveryToken);
    if (!rotated) {
      // Invalid/expired/replayed — client must fall back to a full login.
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    const ticket = await issueAuthTicket(rotated.subject);
    return NextResponse.json({
      success: true,
      ticket,
      recoveryToken: rotated.newToken,
      method: rotated.subject.method,
      phone: rotated.subject.phone,
      partnerId: rotated.subject.partnerId,
      email: rotated.subject.email,
    });
  } catch (error) {
    console.error('[Auth Recover] Error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
