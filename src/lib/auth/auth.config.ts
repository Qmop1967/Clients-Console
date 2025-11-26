import type { NextAuthConfig } from 'next-auth';

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
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.zohoContactId = user.zohoContactId;
        token.priceListId = user.priceListId;
        token.currencyCode = user.currencyCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.zohoContactId = token.zohoContactId as string;
        session.user.priceListId = token.priceListId as string;
        session.user.currencyCode = token.currencyCode as string;
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts
};
