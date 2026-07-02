import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP, normalizePhone } from '@/lib/otp-store';
import { issueAuthTicket, issueRecoveryToken, type AuthSubject } from '@/lib/auth-tickets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = body.phone; // phone number OR email (email logins send the email here)
    const code = body.code || body.otp;
    const method = body.method === 'email' ? 'email' : 'phone';
    const partnerId = Number(body.partnerId || 0);

    if (!identifier || !code) {
      return NextResponse.json(
        { error: 'رقم الهاتف والرمز مطلوبين', errorCode: 'missing_fields' },
        { status: 400 }
      );
    }

    const cleanCode = String(code).trim().replace(/\s/g, '');

    if (!/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json(
        { error: 'الرمز يجب أن يكون 6 أرقام', errorCode: 'invalid_format' },
        { status: 400 }
      );
    }

    const result = verifyOTP(identifier, cleanCode);

    if (!result.valid) {
      const messages: Record<string, string> = {
        expired: 'انتهت صلاحية الرمز. اطلب رمز جديد',
        max_attempts: 'تجاوزت عدد المحاولات. اطلب رمز جديد',
        invalid: 'الرمز غير صحيح',
      };
      return NextResponse.json(
        {
          error: messages[result.error || 'invalid'] || 'الرمز غير صحيح',
          errorCode: result.error || 'invalid',
        },
        { status: 400 }
      );
    }

    // OTP verified server-side. Mint a single-use auth ticket (proof) + a
    // rotating recovery token, bound to the correct identity for the method
    // used. signIn() must present the ticket; authorize() consumes it. Phone
    // (or email) alone can no longer forge a session.
    const isEmail = method === 'email' || String(identifier).includes('@');
    let subject: AuthSubject;
    if (isEmail) {
      if (!Number.isInteger(partnerId) || partnerId <= 0) {
        // Email OTP must resolve a partner (sent from send-email). Without it
        // we cannot bind the ticket safely — refuse rather than over-trust.
        return NextResponse.json(
          { error: 'تعذر التحقق من الحساب', errorCode: 'no_partner' },
          { status: 400 }
        );
      }
      subject = { method: 'email', email: String(identifier).trim().toLowerCase(), partnerId };
      console.log('[OTP Verify] ✅ Verified (email):', subject.email);
    } else {
      subject = { method: 'phone', phone: normalizePhone(identifier) };
      console.log('[OTP Verify] ✅ Verified (phone):', subject.phone);
    }

    const ticket = await issueAuthTicket(subject);
    const recoveryToken = await issueRecoveryToken(subject);

    return NextResponse.json({
      success: true,
      message: 'تم التحقق بنجاح',
      verified: true,
      ticket,
      recoveryToken,
    });
  } catch (error) {
    console.error('[OTP Verify] Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ، حاول مرة أخرى', errorCode: 'server_error' },
      { status: 500 }
    );
  }
}
