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
const publicPaths = ['/login', '/api', '/admin'];

function isPublicPath(pathname: string): boolean {
  // Check if the path includes any public path segment
  return publicPaths.some(path => pathname.includes(path));
}

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for API routes and static files
  // ADMIN_SKIP_INTL_2026_05_02: also skip /admin/* — locale-agnostic admin pages
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Build base URL from forwarded host (behind Nginx proxy)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'tsh.sale';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${proto}://${host}`;

  // Root path -> redirect to login
  if (pathname === '/' || /^\/[a-z]{2}\/?$/.test(pathname)) {
    const locale = pathname.split('/')[1] || defaultLocale;
    return NextResponse.redirect(new URL('/' + locale + '/login', baseUrl));
  }

  // Allow only login/API paths without authentication
  if (isPublicPath(pathname)) {
    return intlMiddleware(request);
  }

  // For protected routes, check for auth session
  const authCookie = request.cookies.get('tsh.session-token') ||
                     request.cookies.get('authjs.session-token') ||
                     request.cookies.get('__Secure-authjs.session-token');

  if (!authCookie) {
    // Redirect to login if not authenticated
    const locale = pathname.split('/')[1] || defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, baseUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
