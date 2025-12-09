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
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes - ensures price list changes are reflected quickly

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
    // CRITICAL: Always fetch fresh Zoho data for ALL customers (with caching)
    // This ensures price list changes in Zoho are reflected within 2 minutes
    async session({ session, user }) {
      const dbUser = user as ExtendedUser;
      if (dbUser && session.user) {
        session.user.id = dbUser.id;

        // ALL customers use cache-then-fetch logic (not just new customers)
        // This ensures price list changes in Zoho are always reflected
        if (session.user.email) {
          const email = session.user.email;
          const contactId = dbUser.zohoContactId; // May have from DB (for faster lookup)
          const cached = zohoDataCache.get(email);

          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            // Use cached Zoho data (applies to ALL customers)
            session.user.zohoContactId = cached.data.zohoContactId;
            session.user.priceListId = cached.data.priceListId;
            session.user.currencyCode = cached.data.currencyCode;
            session.user.name = cached.data.name || session.user.name;
          } else {
            // Fetch FRESH from Zoho (NO CACHE - always real-time for session data)
            // This ensures price list changes are immediately reflected
            // CRITICAL: Always lookup by EMAIL first to get the CURRENT customer in Zoho
            // The database's zohoContactId might be stale if the email was reassigned to a new customer
            try {
              const { getZohoCustomerByEmail, getZohoCustomerFresh } = await import('@/lib/zoho/customers');

              // ALWAYS lookup by email first - this is the source of truth
              // The email might have been reassigned to a different Zoho contact
              let customer;
              const customerBasic = await getZohoCustomerByEmail(email);
              if (customerBasic) {
                customer = await getZohoCustomerFresh(customerBasic.contact_id) || customerBasic;
              }
              // Only fall back to DB contactId if email lookup fails
              if (!customer && contactId) {
                customer = await getZohoCustomerFresh(contactId);
              }

              if (customer) {
                const zohoData = {
                  zohoContactId: customer.contact_id,
                  priceListId: customer.pricebook_id || customer.price_list_id || '',
                  currencyCode: customer.currency_code || 'IQD',
                  name: customer.contact_name,
                };

                // Cache the data
                zohoDataCache.set(email, { data: zohoData, timestamp: Date.now() });

                session.user.zohoContactId = zohoData.zohoContactId;
                session.user.priceListId = zohoData.priceListId;
                session.user.currencyCode = zohoData.currencyCode;
                session.user.name = zohoData.name || session.user.name;
              } else {
                session.user.zohoContactId = '';
                session.user.priceListId = '';
                session.user.currencyCode = 'IQD';
              }
            } catch (error) {
              console.error('[Session] Failed to fetch Zoho data:', error);
              // On error, fall back to DB values if available, otherwise defaults
              session.user.zohoContactId = dbUser.zohoContactId || '';
              session.user.priceListId = dbUser.priceListId || '';
              session.user.currencyCode = dbUser.currencyCode || 'IQD';
              session.user.name = dbUser.name || session.user.name;
            }
          }
        }
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts
};
