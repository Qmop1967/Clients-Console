import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public paths that don't require authentication
      const publicPaths = ['/login', '/shop', '/register', '/api/auth', '/api/health'];
      const isPublicPath = publicPaths.some(path => pathname.includes(path));

      // Also allow root paths
      const isRootPath = pathname === '/' || /^\/[a-z]{2}$/.test(pathname);

      if (isPublicPath || isRootPath) return true;
      if (!isLoggedIn) return false;

      return true;
    },
  },
  providers: [], // Providers added in auth.ts
};
