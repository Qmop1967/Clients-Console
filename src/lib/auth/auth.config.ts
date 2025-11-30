import type { NextAuthConfig } from 'next-auth';
import type { AdapterUser } from '@auth/core/adapters';

// Extended user type for database adapter
interface ExtendedUser extends AdapterUser {
  zohoContactId?: string;
  priceListId?: string;
  currencyCode?: string;
}

// Cache for Zoho customer data to avoid repeated API calls
const zohoDataCache = new Map<string, { data: { zohoContactId: string; priceListId: string; currencyCode: string; name: string }; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
    error: '/login/error',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public paths that don't require authentication
      const publicPaths = ['/login', '/shop', '/register'];
      const isPublicPath = publicPaths.some(path => pathname.includes(path));

      // Also allow root paths (they redirect to shop)
      const isRootPath = pathname === '/' || /^\/[a-z]{2}$/.test(pathname);

      // Allow public paths and root paths for everyone
      if (isPublicPath || isRootPath) {
        return true;
      }

      // Require login for protected paths
      if (!isLoggedIn) {
        return false; // Redirect to login
      }

      return true;
    },
    // Database strategy uses user from database, not token
    async session({ session, user }) {
      const dbUser = user as ExtendedUser;
      if (dbUser && session.user) {
        session.user.id = dbUser.id;

        // If Zoho data is in the user record, use it
        if (dbUser.zohoContactId) {
          session.user.zohoContactId = dbUser.zohoContactId;
          session.user.priceListId = dbUser.priceListId || '';
          session.user.currencyCode = dbUser.currencyCode || 'IQD';
          session.user.name = dbUser.name || session.user.name;
        } else if (session.user.email) {
          // Fallback: Fetch Zoho data if not in database
          // Check cache first
          const cached = zohoDataCache.get(session.user.email);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            session.user.zohoContactId = cached.data.zohoContactId;
            session.user.priceListId = cached.data.priceListId;
            session.user.currencyCode = cached.data.currencyCode;
            session.user.name = cached.data.name || session.user.name;
          } else {
            // Fetch from Zoho (dynamic import to avoid circular deps)
            try {
              const { getZohoCustomerByEmail, getZohoCustomer } = await import('@/lib/zoho/customers');
              const customerBasic = await getZohoCustomerByEmail(session.user.email);

              if (customerBasic) {
                const customerFull = await getZohoCustomer(customerBasic.contact_id);
                const customer = customerFull || customerBasic;

                const zohoData = {
                  zohoContactId: customer.contact_id,
                  priceListId: customer.pricebook_id || customer.price_list_id || '',
                  currencyCode: customer.currency_code || 'IQD',
                  name: customer.contact_name,
                };

                // Cache the data
                zohoDataCache.set(session.user.email, { data: zohoData, timestamp: Date.now() });

                session.user.zohoContactId = zohoData.zohoContactId;
                session.user.priceListId = zohoData.priceListId;
                session.user.currencyCode = zohoData.currencyCode;
                session.user.name = zohoData.name || session.user.name;

                console.log('[Session] Fetched Zoho data for:', session.user.email, zohoData);
              } else {
                session.user.zohoContactId = '';
                session.user.priceListId = '';
                session.user.currencyCode = 'IQD';
              }
            } catch (error) {
              console.error('[Session] Failed to fetch Zoho data:', error);
              session.user.zohoContactId = '';
              session.user.priceListId = '';
              session.user.currencyCode = 'IQD';
            }
          }
        }
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts
};
