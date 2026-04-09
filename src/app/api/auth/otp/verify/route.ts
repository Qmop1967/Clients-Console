import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP, normalizePhone } from '@/lib/otp-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = body.phone;
    const code = body.code || body.otp;

    if (!phone || !code) {
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

    const result = verifyOTP(phone, cleanCode);

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

    // OTP verified! Return success — the frontend will call signIn("phone")
    console.log('[OTP Verify] ✅ Verified:', normalizePhone(phone));

    return NextResponse.json({
      success: true,
      message: 'تم التحقق بنجاح',
      verified: true,
    });
  } catch (error) {
    console.error('[OTP Verify] Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ، حاول مرة أخرى', errorCode: 'server_error' },
      { status: 500 }
    );
  }
}
