// ============================================
// Mobile Auth: Request OTP Code
// POST /api/mobile/auth/login
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { generateOTPCode, storeOTPCode } from '@/lib/auth/mobile-jwt';
import { getCustomerByEmail } from '@/lib/odoo/customers';

// Lazy initialization to avoid build-time errors when env vars are not set
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Request schema
const loginSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'ar']).optional().default('ar'),
});

// Demo account for Apple App Store review
const DEMO_EMAIL = 'demo@tsh.sale';
const DEMO_OTP = '123456';

// OTP email template
function generateOTPEmail(code: string, locale: string): string {
  const isArabic = locale === 'ar';

  return `
<!DOCTYPE html>
<html dir="${isArabic ? 'rtl' : 'ltr'}" lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isArabic ? 'رمز التحقق - TSH' : 'Verification Code - TSH'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f8fafc; direction: ${isArabic ? 'rtl' : 'ltr'};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse;">

          <!-- Logo Section -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <div style="background: linear-gradient(135deg, #d4a853 0%, #c49b47 100%); padding: 3px; border-radius: 16px; display: inline-block;">
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
                    <div style="width: 72px; height: 72px; background: linear-gradient(135deg, #d4a853 0%, #c49b47 100%); border-radius: 50%; margin: 0 auto 20px;">
                      <table role="presentation" style="width: 72px; height: 72px;">
                        <tr>
                          <td align="center" valign="middle" style="background: linear-gradient(135deg, #d4a853 0%, #c49b47 100%); border-radius: 50%;">
                            <span style="font-size: 32px;">🔐</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1e293b;">
                      ${isArabic ? 'رمز التحقق' : 'Verification Code'}
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.6;">
                      ${isArabic ? 'أدخل هذا الرمز في التطبيق لتسجيل الدخول' : 'Enter this code in the app to sign in'}
                    </p>
                  </td>
                </tr>

                <!-- OTP Code Display -->
                <tr>
                  <td style="padding: 8px 32px 32px; text-align: center;">
                    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px dashed #d4a853; border-radius: 16px; padding: 24px;">
                      <p style="margin: 0 0 8px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                        ${isArabic ? 'رمز التحقق الخاص بك' : 'Your verification code'}
                      </p>
                      <p style="margin: 0; font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #1e293b; font-family: 'Courier New', monospace;">
                        ${code}
                      </p>
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
                    <table role="presentation" style="width: 100%; background: #fef3c7; border-radius: 12px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                            ⏱️ ${isArabic ? 'هذا الرمز صالح لمدة' : 'This code expires in'} <strong>${isArabic ? '10 دقائق' : '10 minutes'}</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Security Notice -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.5;">
                      ${isArabic
                        ? '🔒 لا تشارك هذا الرمز مع أي شخص. فريق TSH لن يطلب منك رمز التحقق أبداً.'
                        : '🔒 Never share this code with anyone. TSH team will never ask for your verification code.'}
                    </p>
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
              <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
                © ${new Date().getFullYear()} TSH. ${isArabic ? 'جميع الحقوق محفوظة' : 'All rights reserved'}.
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
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_EMAIL',
            message: 'Please enter a valid email address',
            message_ar: 'يرجى إدخال بريد إلكتروني صحيح',
          },
        },
        { status: 400 }
      );
    }

    const { email, locale } = validation.data;
    const emailLower = email.toLowerCase();

    // Handle demo account for Apple App Store review
    if (emailLower === DEMO_EMAIL) {
      // Store the static demo OTP code
      await storeOTPCode(emailLower, DEMO_OTP);
      console.log(`[Mobile Login] Demo account login: ${emailLower}`);

      return NextResponse.json({
        success: true,
        data: {
          message: 'Demo account: Use code 123456',
          message_ar: 'حساب اختباري: استخدم الرمز 123456',
        },
      });
    }

    // Check if customer exists in the system
    const customer = await getCustomerByEmail(email);

    if (!customer) {
      // Customer not found - they need to be registered in the system first
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'This email is not registered. Please contact TSH to create an account.',
            message_ar: 'هذا البريد الإلكتروني غير مسجل. يرجى التواصل مع TSH لإنشاء حساب.',
          },
        },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP code
    const otpCode = generateOTPCode();

    // Store OTP in Redis with email association (10 min expiry)
    await storeOTPCode(email, otpCode);

    // Send OTP email
    const result = await getResend().emails.send({
      from: process.env.EMAIL_FROM || 'TSH <noreply@tsh.sale>',
      to: email,
      subject: locale === 'ar'
        ? `${otpCode} - رمز التحقق | TSH Verification Code`
        : `${otpCode} - TSH Verification Code | رمز التحقق`,
      html: generateOTPEmail(otpCode, locale),
    });

    if (result.error) {
      console.error('[Mobile Login] Failed to send email:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_FAILED',
            message: 'Failed to send verification code. Please try again.',
            message_ar: 'فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى.',
          },
        },
        { status: 500 }
      );
    }

    console.log(`[Mobile Login] OTP code sent to: ${email}`);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Check your email for a verification code',
        message_ar: 'تحقق من بريدك الإلكتروني للحصول على رمز التحقق',
      },
    });

  } catch (error) {
    console.error('[Mobile Login] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An error occurred. Please try again.',
          message_ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
        },
      },
      { status: 500 }
    );
  }
}
