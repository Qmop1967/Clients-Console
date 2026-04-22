import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { getCustomerByPhone, getCustomerById } from '@/lib/odoo/customers';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    // Phone-based login: customer enters phone → we find them in Odoo
    Credentials({
      id: 'phone',
      name: 'Phone',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
      },
      async authorize(credentials) {
        if (!credentials?.phone) return null;

        const phone = String(credentials.phone).trim();
        if (!phone) return null;

        try {
          const customer = await getCustomerByPhone(phone);

          if (!customer) {
            console.log('[Auth] No customer found for phone:', phone);
            return null;
          }

          console.log('[Auth] Customer found:', {
            contactId: customer.contact_id,
            name: customer.contact_name,
            priceListId: customer.pricebook_id || customer.price_list_id,
            currency: customer.currency_code,
          });

          return {
            id: customer.contact_id,
            name: customer.contact_name,
            email: customer.email || `${customer.contact_id}@tsh.local`,
            odooContactId: customer.contact_id,
            priceListId: customer.pricebook_id || customer.price_list_id || '',
            currencyCode: customer.currency_code || 'IQD',
          };
        } catch (error) {
          console.error('[Auth] Error during phone login:', error);
          return null;
        }
      },
    }),
    // Email-based login: OTP sent to email, signIn carries the partnerId
    // that was resolved server-side (in /api/auth/otp/send-email) to avoid
    // any lookup ambiguity at this stage.
    Credentials({
      id: 'email',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        partnerId: { label: 'PartnerId', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const emailRaw = String(credentials?.email || '').trim().toLowerCase();
          const partnerIdStr = String(credentials?.partnerId || '').trim();
          const partnerId = Number(partnerIdStr);
          if (!emailRaw || !emailRaw.includes('@')) return null;
          if (!Number.isInteger(partnerId) || partnerId <= 0) return null;

          const customer = await getCustomerById(partnerId);
          if (!customer) {
            console.log('[Auth] No customer for partnerId:', partnerId);
            return null;
          }
          // Safety: the partner must actually own this email.
          const ownEmail = String(customer.email || '').trim().toLowerCase();
          if (ownEmail !== emailRaw) {
            console.warn('[Auth] Email/partner mismatch — refusing', { partnerId, emailRaw });
            return null;
          }

          console.log('[Auth] Customer found (email):', {
            contactId: customer.contact_id,
            name: customer.contact_name,
            priceListId: customer.pricebook_id || customer.price_list_id,
            currency: customer.currency_code,
          });

          return {
            id: customer.contact_id,
            name: customer.contact_name,
            email: customer.email || `${customer.contact_id}@tsh.local`,
            odooContactId: customer.contact_id,
            priceListId: customer.pricebook_id || customer.price_list_id || '',
            currencyCode: customer.currency_code || 'IQD',
          };
        } catch (error) {
          console.error('[Auth] Error during email login:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.odooContactId = (user as any).odooContactId;
        token.priceListId = (user as any).priceListId;
        token.currencyCode = (user as any).currencyCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.odooPartnerId = token.odooContactId as string;
        session.user.priceListId = token.priceListId as string;
        session.user.currencyCode = token.currencyCode as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 365 days
    // updateAge: re-issue JWT (and rewrite cookie WITH maxAge) at most once per 24h
    // of activity. This is the key fix that keeps customers signed in across days —
    // without it, NextAuth v5 rewrites the cookie on every request without Max-Age,
    // which turns it into a session cookie that dies when the browser/PWA closes.
    updateAge: 24 * 60 * 60, // 24 hours
  },
  // Explicit JWT lifetime — NextAuth v5 beta does not always inherit session.maxAge
  // onto the JWT `exp` claim. Setting this explicitly guarantees 365-day tokens.
  jwt: {
    maxAge: 365 * 24 * 60 * 60, // 365 days
  },
  // Use non-prefixed cookie names so they work consistently across all browsers
  // __Secure- prefix causes issues on some mobile browsers when app is closed
  useSecureCookies: false,
  cookies: {
    sessionToken: {
      name: 'tsh.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: 365 * 24 * 60 * 60, // 365 days
      },
    },
    csrfToken: {
      name: 'tsh.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: 'tsh.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },
});

// Type augmentation for NextAuth
declare module 'next-auth' {
  interface User {
    odooContactId?: string;
    odooPartnerId?: string;
    priceListId?: string;
    currencyCode?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      odooPartnerId?: string;
      priceListId?: string;
      currencyCode?: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    odooContactId?: string;
    priceListId?: string;
    currencyCode?: string;
  }
}
