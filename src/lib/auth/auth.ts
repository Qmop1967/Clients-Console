import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Resend from 'next-auth/providers/resend';
import Credentials from 'next-auth/providers/credentials';
import { UpstashRedisAdapter } from '@auth/upstash-redis-adapter';
import { Redis } from '@upstash/redis';
import { getZohoCustomerByEmail, getZohoCustomerFresh } from '@/lib/zoho/customers';
import { Resend as ResendClient } from 'resend';

// Initialize Upstash Redis client for NextAuth adapter
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Professional Arabic Email Template
function generateMagicLinkEmail(url: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تسجيل الدخول - TSH</title>
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
                      مرحباً بك في TSH
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.6;">
                      اضغط على الزر أدناه لتسجيل الدخول إلى حسابك
                    </p>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td style="padding: 8px 32px 32px; text-align: center;">
                    <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 48px; border-radius: 12px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                      تسجيل الدخول
                    </a>
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
                                  هذا الرابط صالح لمدة <strong style="color: #1e293b;">24 ساعة</strong> فقط
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
                                  إذا لم تطلب هذا البريد، يمكنك تجاهله بأمان
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

// Build providers array
const providers = [];

// Add OTP Credentials Provider (uses NextAuth's built-in session management)
providers.push(
  Credentials({
    id: 'otp',
    name: 'OTP',
    credentials: {
      email: { label: 'Email', type: 'email' },
      code: { label: 'Code', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.code) {
        return null;
      }

      // Normalize email
      const normalizedEmail = credentials.email.toLowerCase().trim();
      const cleanCode = String(credentials.code).trim().replace(/\s/g, '');

      // Get OTP from Redis
      const otpKey = `otp:${normalizedEmail}`;
      const storedOTP = await redis.get<string>(otpKey);
      const cleanStoredOTP = storedOTP ? String(storedOTP).trim().replace(/\s/g, '') : null;

      console.log('[OTP Auth] Verifying:', {
        email: normalizedEmail,
        codeMatch: cleanStoredOTP === cleanCode,
      });

      // Verify OTP
      if (!cleanStoredOTP || cleanStoredOTP !== cleanCode) {
        console.error('[OTP Auth] Invalid code');
        return null;
      }

      // Delete OTP after successful verification
      await redis.del(otpKey);

      // Return user object - NextAuth will create session automatically
      return {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
      };
    },
  })
);

// Add Resend provider for magic link emails with custom Arabic template
if (process.env.RESEND_API_KEY) {
  const resendClient = new ResendClient(process.env.RESEND_API_KEY);

  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || 'TSH <noreply@tsh.sale>',
      async sendVerificationRequest({ identifier: email, url, provider }) {
        try {
          const fromEmail = provider.from || 'TSH <noreply@tsh.sale>';
          const result = await resendClient.emails.send({
            from: fromEmail,
            to: email,
            subject: 'تسجيل الدخول إلى TSH | Sign in to TSH',
            html: generateMagicLinkEmail(url),
          });

          if (result.error) {
            throw new Error(result.error.message);
          }

          console.log('[Auth] Magic link email sent to:', email);
        } catch (error) {
          console.error('[Auth] Failed to send magic link email:', error);
          throw new Error('Failed to send verification email');
        }
      },
    })
  );
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: UpstashRedisAdapter(redis),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        // First, find customer by email (list endpoint - returns basic data)
        const customerBasic = await getZohoCustomerByEmail(user.email);

        if (customerBasic) {
          // Fetch full customer details by ID (single endpoint - returns all fields)
          // CRITICAL: Use uncached fetch to get fresh price list and currency data
          const customerFull = await getZohoCustomerFresh(customerBasic.contact_id);
          const customer = customerFull || customerBasic;

          // Existing customer - attach Zoho data
          // Note: Zoho Books uses pricebook_id, not price_list_id
          user.zohoContactId = customer.contact_id;
          user.priceListId = customer.pricebook_id || customer.price_list_id || '';
          user.currencyCode = customer.currency_code;
          user.name = customer.contact_name;

          console.log('[Auth] Customer data fetched:', {
            contactId: customer.contact_id,
            priceListId: customer.pricebook_id || customer.price_list_id,
            pricebookName: customer.pricebook_name,
            currencyCode: customer.currency_code,
          });
        } else {
          // New customer - will be created on first order
          // For now, just allow login with default settings
          user.zohoContactId = '';
          user.priceListId = '';
          user.currencyCode = 'IQD';
          console.log('[Auth] New customer - no Zoho contact found for:', user.email);
        }

        return true;
      } catch (error) {
        console.error('Error during sign in:', error);
        // Allow sign in even if Zoho check fails
        return true;
      }
    },
  },
  session: {
    strategy: 'database',
    maxAge: 365 * 24 * 60 * 60, // 365 days - persistent login
    updateAge: 24 * 60 * 60, // Update session every 24 hours to keep it fresh
  },
  debug: process.env.NODE_ENV === 'development', // Only enable debug in development
});

// Type augmentation for NextAuth
declare module 'next-auth' {
  interface User {
    zohoContactId?: string;
    priceListId?: string;
    currencyCode?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      zohoContactId?: string;
      priceListId?: string;
      currencyCode?: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    zohoContactId?: string;
    priceListId?: string;
    currencyCode?: string;
  }
}
