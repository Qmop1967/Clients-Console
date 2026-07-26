const TSH_LOCALES = new Set(['ar', 'en', 'ckb', 'kmr', 'tm']);

function safePathSegment(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/**
 * Meta measurement is deliberately limited to public storefront routes.
 * Auth, account, order, invoice, payment, admin, callback, and support routes
 * are excluded so private identifiers cannot become event-source URLs.
 */
export function isAllowedTshMeasurementPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length || !TSH_LOCALES.has(segments[0])) return false;

  const route = segments.slice(1);
  if (route.length === 0) return true;

  switch (route[0]) {
    case 'catalog':
    case 'products':
    case 'cart':
      return route.length === 1;
    case 'p':
      return route.length === 2 && safePathSegment(route[1]);
    case 'shop':
      return route.length === 1 || (route.length === 2 && safePathSegment(route[1]));
    case 'wholesale':
      return route.length === 1 || (route.length === 2 && route[1] === 'ac-adapters');
    default:
      return false;
  }
}

function allowedTshUrl(value: string): URL | null {
  try {
    if (value.length > 2048) return null;
    const url = new URL(value);
    if (url.username || url.password) return null;

    if (process.env.NODE_ENV === 'production') {
      if (url.origin !== 'https://tsh.sale' && url.origin !== 'https://www.tsh.sale') {
        return null;
      }
    } else if (
      url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1' &&
      url.hostname !== 'tsh.sale' &&
      url.hostname !== 'www.tsh.sale'
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function isAllowedTshOrigin(value: string): boolean {
  const url = allowedTshUrl(value);
  return Boolean(url && url.pathname === '/' && !url.search && !url.hash);
}

export function normalizeTshMeasurementUrl(value: string): string | null {
  const url = allowedTshUrl(value);
  if (!url || !isAllowedTshMeasurementPath(url.pathname)) return null;

  // Meta receives only the canonical public path. Query strings and fragments
  // may contain searches, callback values, or other data that is not needed.
  url.search = '';
  url.hash = '';
  return `${url.origin}${url.pathname}`;
}
