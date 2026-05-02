/**
 * TSH Clients Service Worker
 * Version: v1 (2026-04-22)
 *
 * Purpose: enable full PWA behavior on iOS Safari so the app stays
 * installed as a real app (not a shortcut) and preserves cookies/state
 * across close-reopen cycles.
 *
 * Strategy:
 * - Network-first for HTML navigations (always fresh, fall back to cache offline)
 * - Cache-first for /_next/static/*, /icons/*, and static images (immutable)
 * - Bypass completely: /api/*, /api/auth/*, and any non-GET requests
 *
 * The SW MUST NOT touch auth or API requests — it only accelerates
 * static asset delivery and lets iOS treat the install as a real PWA.
 */

const CACHE_VERSION = 'tsh-clients-v2-2026-05-02';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Pre-cache these on install so the app has a usable offline shell
const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// -----------------------------------------------------------------------------
// INSTALL — pre-cache the offline shell
// -----------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Don't fail install if a precache URL is missing; degrade gracefully
        console.warn('[SW] Precache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// -----------------------------------------------------------------------------
// ACTIVATE — clean up old caches and take control immediately
// -----------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// -----------------------------------------------------------------------------
// FETCH — the request router
// -----------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Rule 1: NEVER handle non-GET requests. Let them pass through.
  if (req.method !== 'GET') return;

  // Rule 2: NEVER handle cross-origin requests (CDN, Sentry, Cloudflare, etc).
  if (url.origin !== self.location.origin) return;

  // Rule 3: NEVER touch /api/* — these are dynamic data & auth-critical.
  // Letting the SW handle them could break session cookies, OTP flows,
  // and cart mutations. Auth is the #1 reason to be conservative here.
  if (url.pathname.startsWith('/api/')) return;

  // Rule 4: Static assets — cache-first (they are immutable, hashed URLs).
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Rule 5: manifest.json — stale-while-revalidate
  if (url.pathname === '/manifest.json') {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Rule 6: HTML navigations — network-first, fall back to cache offline.
  // We detect HTML by the Accept header or the fetch destination.
  if (req.mode === 'navigate' || req.destination === 'document' ||
      (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Default: just fetch; don't cache.
});

// -----------------------------------------------------------------------------
// Strategy: cache-first (for immutable static assets)
// -----------------------------------------------------------------------------
async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response.ok && response.status < 400) {
      cache.put(req, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Offline and asset not in cache — return a graceful opaque response
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

// -----------------------------------------------------------------------------
// Strategy: network-first (for HTML pages — always prefer fresh)
// -----------------------------------------------------------------------------
async function networkFirstHtml(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(req);
    // Only cache successful HTML responses for offline fallback
    if (response.ok && response.status === 200) {
      cache.put(req, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Offline — try cache, then offline page fallback
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(
      '<!doctype html><html><head><meta charset="utf-8"><title>Offline</title>' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{font-family:system-ui;margin:0;padding:2rem;background:#1C1930;color:#fff;text-align:center}' +
      'h1{margin-top:4rem}p{opacity:.8}</style></head>' +
      '<body><h1>🛜 لا يوجد اتصال</h1>' +
      '<p>يرجى التحقق من الإنترنت والمحاولة مرة أخرى.</p>' +
      '<button onclick="location.reload()" style="background:#fff;color:#1C1930;border:0;padding:.75rem 2rem;border-radius:.5rem;font-size:1rem;cursor:pointer">إعادة المحاولة</button>' +
      '</body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// -----------------------------------------------------------------------------
// Strategy: stale-while-revalidate (for manifest.json and similar)
// -----------------------------------------------------------------------------
async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((response) => {
    if (response.ok) cache.put(req, response.clone()).catch(() => {});
    return response;
  }).catch(() => cached);
  return cached || networkPromise;
}

// -----------------------------------------------------------------------------
// MESSAGE — allow the app to trigger updates from the client side
// -----------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
