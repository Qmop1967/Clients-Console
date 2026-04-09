import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { getCustomerByPhone } from '@/lib/odoo/customers';

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
