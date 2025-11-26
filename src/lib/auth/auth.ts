import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Resend from 'next-auth/providers/resend';
import { getZohoCustomerByEmail, createZohoCustomer } from '@/lib/zoho/customers';

// Build providers array conditionally
const providers = [];

// Only add Resend provider if API key is configured
if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your-resend-api-key') {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || 'TSH <noreply@tsh.sale>',
      // Custom email template
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { Resend: ResendClient } = await import('resend');
        const resend = new ResendClient(provider.apiKey);

        try {
          await resend.emails.send({
            from: provider.from!,
            to: email,
            subject: 'Sign in to TSH Clients Console',
            html: `
              <!DOCTYPE html>
              <html dir="ltr">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1a1a1a; margin: 0; font-size: 24px;">TSH</h1>
                    <p style="color: #666; margin-top: 5px;">Clients Console</p>
                  </div>

                  <p style="color: #333; font-size: 16px; line-height: 1.6;">
                    Click the button below to sign in to your TSH account:
                  </p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${url}" style="display: inline-block; background-color: #0070f3; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      Sign In to TSH
                    </a>
                  </div>

                  <p style="color: #666; font-size: 14px; line-height: 1.5;">
                    If you didn't request this email, you can safely ignore it.
                  </p>

                  <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                    This link will expire in 24 hours and can only be used once.
                  </p>
                </div>
              </body>
              </html>
            `,
          });
        } catch (error) {
          console.error('Failed to send verification email:', error);
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
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, email }) {
      if (!user.email) return false;

      try {
        // Check if customer exists in Zoho
        const customer = await getZohoCustomerByEmail(user.email);

        if (customer) {
          // Existing customer - attach Zoho data
          user.zohoContactId = customer.contact_id;
          user.priceListId = customer.price_list_id;
          user.currencyCode = customer.currency_code;
          user.name = customer.contact_name;
        } else {
          // New customer - will be created on first order
          // For now, just allow login with default settings
          user.zohoContactId = '';
          user.priceListId = '';
          user.currencyCode = 'IQD';
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
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === 'development',
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
