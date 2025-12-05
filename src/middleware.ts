import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

// Public paths that don't require authentication
// Note: /products redirects to /shop, so it must be public too
const publicPaths = ['/login', '/shop', '/cart', '/register', '/api', '/products'];

function isPublicPath(pathname: string): boolean {
  // Check if the path includes any public path segment
  return publicPaths.some(path => pathname.includes(path));
}

function isRootPath(pathname: string): boolean {
  // Root path or just locale (e.g., /en, /ar)
  return pathname === '/' || /^\/[a-z]{2}\/?$/.test(pathname);
}

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for API routes and static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Allow public paths and root paths without authentication
  if (isPublicPath(pathname) || isRootPath(pathname)) {
    return intlMiddleware(request);
  }

  // For protected routes, check for auth session
  const authCookie = request.cookies.get('authjs.session-token') ||
                     request.cookies.get('__Secure-authjs.session-token');

  if (!authCookie) {
    // Redirect to login if not authenticated
    const locale = pathname.split('/')[1] || defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
