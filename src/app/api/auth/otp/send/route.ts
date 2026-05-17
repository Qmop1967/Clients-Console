import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, normalizePhone, whatsappNumber, isRateLimited, storeOTP } from '@/lib/otp-store';
import { sendWhatsAppOTP, isDevMode } from '@/lib/whatsapp';

// Search customer in Odoo by phone via Gateway
async function findCustomerByPhone(phone: string): Promise<boolean> {
  const gatewayUrl = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
  const apiKey = process.env.API_KEY || '';

  const normalized = normalizePhone(phone);
  const bare = normalized.replace('+', '');
  const local = '0' + bare.replace('964', '');
  const short = bare.replace('964', '');
  const last10 = bare.slice(-10);

  const phoneVariants = [local, normalized, bare, short, `'+${bare}`, `'+${local}`];

  try {
    // 1. Direct customer search (customer_rank > 0)
    const res = await fetch(`${gatewayUrl}/api/odoo/search_read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'res.partner',
        domain: [
          '&', ['customer_rank', '>', 0],
          '|', '|', '|', '|', '|',
          ['phone', 'in', phoneVariants],
          ['mobile', 'in', phoneVariants],
          ['phone', 'ilike', last10],
          ['mobile', 'ilike', last10],
          ['phone', 'ilike', local],
          ['mobile', 'ilike', local],
        ],
        fields: ['id', 'name', 'phone', 'mobile'],
        limit: 1,
      }),
    });

    const data = await res.json();
    const records = data?.data || data?.result || data || [];
    if (Array.isArray(records) && records.length > 0) return true;

    // 2. Delegate search: child contacts with parent_id (employee of a customer)
    const delegateRes = await fetch(`${gatewayUrl}/api/odoo/search_read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'res.partner',
        domain: [
          '&', '&', ['parent_id', '!=', false], ['active', '=', true],
          '|', '|', '|', '|', '|',
          ['phone', 'in', phoneVariants],
          ['mobile', 'in', phoneVariants],
          ['phone', 'ilike', last10],
          ['mobile', 'ilike', last10],
          ['phone', 'ilike', local],
          ['mobile', 'ilike', local],
        ],
        fields: ['id', 'name', 'parent_id'],
        limit: 1,
      }),
    });

    const delegateData = await delegateRes.json();
    const delegateRecords = delegateData?.data || delegateData?.result || delegateData || [];
    if (Array.isArray(delegateRecords) && delegateRecords.length > 0) {
      console.log('[OTP Send] Delegate found:', delegateRecords[0]?.name, '-> parent:', delegateRecords[0]?.parent_id);
      return true;
    }

    return false;
  } catch (err) {
    console.error('[OTP Send] Gateway error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب', errorCode: 'missing_phone' },
        { status: 400 }
      );
    }

    let digits = phone.trim().replace(/[^\d]/g, '');
    if (digits.startsWith('00')) digits = digits.substring(2);
    if (digits.startsWith('964')) digits = digits.substring(3);
    if (digits.startsWith('0')) digits = digits.substring(1);

    if (!digits.startsWith('7') || digits.length !== 10) {
      return NextResponse.json(
        { error: 'رقم الهاتف غير صحيح. أدخل رقم عراقي يبدأ بـ 07', errorCode: 'invalid_phone' },
        { status: 400 }
      );
    }

    const cleaned = '0' + digits;

    if (isRateLimited(cleaned)) {
      return NextResponse.json(
        { error: 'انتظر دقيقة قبل طلب رمز جديد', errorCode: 'rate_limited' },
        { status: 429 }
      );
    }

    const exists = await findCustomerByPhone(cleaned);
    if (!exists) {
      return NextResponse.json(
        { error: 'رقم الهاتف غير مسجل لدينا. تواصل مع المبيعات للتسجيل', errorCode: 'not_found' },
        { status: 404 }
      );
    }

    const otp = generateOTP();
    storeOTP(cleaned, otp);

    const waNumber = whatsappNumber(cleaned);
    const result = await sendWhatsAppOTP(waNumber, otp);

    if (!result.success) {
      console.error('[OTP Send] WhatsApp failed:', result.error);
      // WhatsApp down — redirect to email login (Firebase SMS disabled: billing-not-enabled)
      return NextResponse.json({
        success: false,
        fallback: 'email',
        phone: cleaned,
        message: 'خدمة الواتساب غير متاحة حالياً، يرجى تسجيل الدخول عبر البريد الإلكتروني',
        errorCode: 'whatsapp_down',
      }, { status: 200 });
    }

    console.log('[OTP Send] ✅ OTP sent to:', cleaned, isDevMode() ? `(DEV: ${otp})` : '');

    const response: Record<string, unknown> = {
      success: true,
      message: 'تم إرسال رمز التحقق على الواتساب',
    };

    if (isDevMode()) {
      response.devOtp = otp;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[OTP Send] Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ، حاول مرة أخرى', errorCode: 'server_error' },
      { status: 500 }
    );
  }
}
