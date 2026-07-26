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

      const parts = pathname.split('/').filter(Boolean);
      const [, section, id, extra] = parts;

      // Keep this callback as a second, exact-match defense. Substring matching
      // here previously made paths containing "/shop" or "/login" public.
      const isPublicPage =
        (!id && (section === 'login' || section === 'register')) ||
        (section === 'shop' && (!id || (!extra && /^\d+$/.test(id))));

      // Auth and health are the only intentionally public API namespaces here.
      // Every business API must perform its own authorization.
      const isPublicApi =
        pathname.startsWith('/api/auth/') ||
        pathname === '/api/health';

      // Also allow root paths
      const isRootPath = pathname === '/' || /^\/[a-z]{2,3}$/.test(pathname);

      if (isPublicPage || isPublicApi || isRootPath) return true;
      if (!isLoggedIn) return false;

      return true;
    },
  },
  providers: [], // Providers added in auth.ts
};
