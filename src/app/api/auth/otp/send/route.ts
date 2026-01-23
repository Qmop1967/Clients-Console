import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

const resend = new Resend(process.env.RESEND_API_KEY);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Professional Arabic OTP Email Template
function generateOTPEmail(code: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>رمز التحقق - TSH</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f8fafc; direction: rtl;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse;">

          <!-- Logo Section -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%); padding: 3px; border-radius: 16px; display: inline-block;">
                <div style="background: white; padding: 16px 24px; border-radius: 14px;">
                  <img src="https://www.tsh.sale/images/tsh-logo.jpg" alt="TSH" style="height: 50px; width: auto; display: block;" />
                </div>
              </div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: white; border-radius: 24px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">

                <!-- Header -->
                <tr>
                  <td style="padding: 40px 32px 24px; text-align: center;">
                    <div style="width: 72px; height: 72px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <table role="presentation" style="width: 72px; height: 72px;">
                        <tr>
                          <td align="center" valign="middle" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50%;">
                            <img src="https://img.icons8.com/fluency/48/ffffff/password.png" alt="" style="width: 36px; height: 36px;" />
                          </td>
                        </tr>
                      </table>
                    </div>
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1e293b;">
                      رمز التحقق الخاص بك
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.6;">
                      استخدم الرمز التالي لتسجيل الدخول
                    </p>
                  </td>
                </tr>

                <!-- OTP Code -->
                <tr>
                  <td style="padding: 8px 32px 32px; text-align: center;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px 48px; border-radius: 16px; border: 2px solid #3b82f6; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.15);">
                      <div style="font-size: 42px; font-weight: 800; color: #1e293b; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${code}
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 32px;">
                    <div style="height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent);"></div>
                  </td>
                </tr>

                <!-- Info Box -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <table role="presentation" style="width: 100%; background: #f8fafc; border-radius: 12px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 40px; vertical-align: top;">
                                <div style="width: 32px; height: 32px; background: #dbeafe; border-radius: 8px; text-align: center; line-height: 32px;">
                                  <span style="font-size: 16px;">⏱️</span>
                                </div>
                              </td>
                              <td style="vertical-align: middle; padding-right: 12px;">
                                <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                                  هذا الرمز صالح لمدة <strong style="color: #1e293b;">10 دقائق</strong> فقط
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Security Note -->
                <tr>
                  <td style="padding: 0 32px 32px;">
                    <table role="presentation" style="width: 100%; background: #fef3c7; border-radius: 12px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 40px; vertical-align: top;">
                                <div style="width: 32px; height: 32px; background: #fde68a; border-radius: 8px; text-align: center; line-height: 32px;">
                                  <span style="font-size: 16px;">🔒</span>
                                </div>
                              </td>
                              <td style="vertical-align: middle; padding-right: 12px;">
                                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                                  لا تشارك هذا الرمز مع أي شخص. إذا لم تطلب هذا، يمكنك تجاهل هذا البريد بأمان
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 20px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">
                <strong style="color: #1e293b;">TSH</strong> - Tech Spider Hand
              </p>
              <p style="margin: 0 0 16px; font-size: 13px; color: #94a3b8;">
                بوابة العملاء للبيع بالجملة
              </p>
              <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
                © ${new Date().getFullYear()} TSH. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in Redis with 10 minute expiration
    const otpKey = `otp:${email}`;
    await redis.setex(otpKey, 600, otp); // 600 seconds = 10 minutes

    console.log('[OTP Send] Generated and stored OTP:', {
      email,
      code: otp,
      key: otpKey,
    });

    // Send OTP email
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'TSH <noreply@tsh.sale>',
      to: email,
      subject: 'رمز التحقق - TSH | Your verification code - TSH',
      html: generateOTPEmail(otp),
    });

    if (result.error) {
      console.error('[OTP Send] Failed to send email:', result.error);
      return NextResponse.json(
        { error: 'Failed to send verification code' },
        { status: 500 }
      );
    }

    console.log('[OTP Send] Verification code sent to:', email);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully',
    });
  } catch (error) {
    console.error('[OTP Send] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
