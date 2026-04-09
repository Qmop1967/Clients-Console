import { NextRequest, NextResponse } from 'next/server';
import { storeOTP } from '@/lib/otp-store';

// Search customer in Odoo by phone via Gateway
async function findCustomerByPhone(phone: string): Promise<{ found: boolean; partnerId?: number; name?: string }> {
  const gatewayUrl = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
  const apiKey = process.env.API_KEY || '';

  // Normalize: phone comes as +9647xxxxxxxxx
  const digits = phone.replace(/\D/g, '');
  const local = '0' + digits.replace(/^964/, ''); // 07xxxxxxxxx
  const bare = digits; // 9647xxxxxxxxx
  const short = digits.replace(/^964/, ''); // 7xxxxxxxxx
  const last10 = digits.slice(-10);

  try {
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
          ['phone', 'in', [local, `+${bare}`, bare, short, `+${local}`, phone]],
          ['mobile', 'in', [local, `+${bare}`, bare, short, `+${local}`, phone]],
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
    if (Array.isArray(records) && records.length > 0) {
      return { found: true, partnerId: records[0].id, name: records[0].name };
    }
    return { found: false };
  } catch (err) {
    console.error('[Firebase Verify] Gateway error:', err);
    return { found: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone, firebaseUid } = await request.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب', errorCode: 'missing_phone' },
        { status: 400 }
      );
    }

    if (!firebaseUid || typeof firebaseUid !== 'string') {
      return NextResponse.json(
        { error: 'معرف Firebase مطلوب', errorCode: 'missing_uid' },
        { status: 400 }
      );
    }

    // Check if customer exists in Odoo
    const customer = await findCustomerByPhone(phone);
    if (!customer.found) {
      return NextResponse.json(
        { error: 'رقم الهاتف غير مسجل لدينا. تواصل مع المبيعات للتسجيل', errorCode: 'not_found' },
        { status: 404 }
      );
    }

    // Generate a session OTP — the existing verify endpoint will handle NextAuth session creation
    // We store a verified OTP so the client can call /api/auth/otp/verify with it
    const verifiedOtp = '000000'; // Special marker for Firebase-verified sessions
    const digits = phone.replace(/\D/g, '');
    const local = '0' + digits.replace(/^964/, '');
    storeOTP(local, verifiedOtp);

    return NextResponse.json({
      success: true,
      phone: local,
      otp: verifiedOtp,
      partnerId: customer.partnerId,
      name: customer.name,
    });
  } catch (error) {
    console.error('[Firebase Verify] Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ، حاول مرة أخرى', errorCode: 'server_error' },
      { status: 500 }
    );
  }
}
