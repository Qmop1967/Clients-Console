// ============================================
// Mobile Auth: Request Magic Link
// POST /api/mobile/auth/login
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { storeMobileVerificationToken } from '@/lib/auth/mobile-jwt';
import { getZohoCustomerByEmail } from '@/lib/zoho/customers';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

// Request schema
const loginSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'ar']).optional().default('ar'),
});

// Mobile-specific magic link email template
function generateMobileMagicLinkEmail(token: string, locale: string): string {
  const appLink = `tsh://auth/verify?token=${token}`;
  const webFallback = `${process.env.NEXTAUTH_URL}/api/mobile/auth/callback?token=${token}`;

  const isArabic = locale === 'ar';

  return `
<!DOCTYPE html>
<html dir="${isArabic ? 'rtl' : 'ltr'}" lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isArabic ? 'تسجيل الدخول - TSH' : 'Sign In - TSH'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f8fafc; direction: ${isArabic ? 'rtl' : 'ltr'};">
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
                    <div style="width: 72px; height: 72px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin: 0 auto 20px;">
                      <table role="presentation" style="width: 72px; height: 72px;">
                        <tr>
                          <td align="center" valign="middle" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%;">
                            <span style="font-size: 32px;">📱</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1e293b;">
                      ${isArabic ? 'تسجيل الدخول للتطبيق' : 'Sign In to TSH App'}
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.6;">
                      ${isArabic ? 'اضغط على الزر أدناه لفتح التطبيق وتسجيل الدخول' : 'Tap the button below to open the app and sign in'}
                    </p>
                  </td>
                </tr>

                <!-- Open App Button -->
                <tr>
                  <td style="padding: 8px 32px 16px; text-align: center;">
                    <a href="${appLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 48px; border-radius: 12px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                      ${isArabic ? 'فتح التطبيق' : 'Open App'}
                    </a>
                  </td>
                </tr>

                <!-- Web Fallback Link -->
                <tr>
                  <td style="padding: 0 32px 24px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #94a3b8;">
                      ${isArabic ? 'أو ' : 'Or '}
                      <a href="${webFallback}" style="color: #3b82f6; text-decoration: underline;">
                        ${isArabic ? 'اضغط هنا إذا لم يفتح التطبيق' : 'click here if app doesn\'t open'}
                      </a>
                    </p>
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
                          <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                            ⏱️ ${isArabic ? 'هذا الرابط صالح لمدة' : 'This link expires in'} <strong style="color: #1e293b;">24 ${isArabic ? 'ساعة' : 'hours'}</strong>
                          </p>
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

    // Check if customer exists in Zoho
    const customer = await getZohoCustomerByEmail(email);

    if (!customer) {
      // Customer not found - they need to be registered in Zoho first
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

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Store token in Redis with email association
    await storeMobileVerificationToken(email, verificationToken);

    // Send magic link email
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'TSH <noreply@tsh.sale>',
      to: email,
      subject: locale === 'ar'
        ? 'تسجيل الدخول لتطبيق TSH | Sign in to TSH App'
        : 'Sign in to TSH App | تسجيل الدخول لتطبيق TSH',
      html: generateMobileMagicLinkEmail(verificationToken, locale),
    });

    if (result.error) {
      console.error('[Mobile Login] Failed to send email:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_FAILED',
            message: 'Failed to send login email. Please try again.',
            message_ar: 'فشل إرسال البريد الإلكتروني. يرجى المحاولة مرة أخرى.',
          },
        },
        { status: 500 }
      );
    }

    console.log(`[Mobile Login] Magic link sent to: ${email}`);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Check your email for a login link',
        message_ar: 'تحقق من بريدك الإلكتروني للحصول على رابط تسجيل الدخول',
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
