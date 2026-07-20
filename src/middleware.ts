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

// PUBLIC COMPANY PAGES — 2026-07-20
// Meta disabled all five TSH WhatsApp Business Accounts on 2026-07-18 with the reason:
// "the website listed in its Business Manager profile does not have information needed
// to determine that your business complies with our Business Policy."
// Cause: every anonymous visit to tsh.sale was redirected to /login, so a reviewer (and
// every crawler) saw nothing but a sign-in form. These segments are the public
// shop-window and MUST stay reachable with no session. Trading stays gated.
// Exact segment match at depth 2 only — publicPaths uses substring matching, which would
// leak deeper routes.
const PUBLIC_MARKETING = new Set(['about', 'catalog', 'contact-us', 'privacy', 'terms']);

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

  // Read the session once — the root branch and the guard below both need it.
  const authCookie = request.cookies.get('tsh.session-token') ||
                     request.cookies.get('authjs.session-token') ||
                     request.cookies.get('__Secure-authjs.session-token');

  // Bare domain -> default locale, so tsh.sale resolves to a real page.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/' + defaultLocale, baseUrl));
  }

  // /[locale] root.
  // 2026-07-15: was '/login'; forcing users with a VALID session onto the login
  // form was a root cause of the "asked to log in every time" complaint.
  // 2026-07-20: signed-in partners still land on /shop exactly as before. Anonymous
  // visitors now get the public company page instead of a redirect into /login.
  if (/^\/[a-z]{2,3}\/?$/.test(pathname)) {
    const locale = pathname.split('/')[1] || defaultLocale;
    if (authCookie) {
      return NextResponse.redirect(new URL('/' + locale + '/shop', baseUrl));
    }
    return intlMiddleware(request);
  }

  const seg = pathname.split('/');

  // Public company pages (about / catalog / contact-us / privacy / terms) — no auth.
  if (seg[2] && PUBLIC_MARKETING.has(seg[2]) && !seg[3]) {
    return intlMiddleware(request);
  }

  // Public share pages (product /p/:id, category /c/:id) — no auth, for WhatsApp/social sharing
  if ((seg[2] === "p" || seg[2] === "c") && seg[3]) {
    return intlMiddleware(request);
  }

  // Allow only login/API paths without authentication
  if (isPublicPath(pathname)) {
    return intlMiddleware(request);
  }

  // For protected routes, check for auth session
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
