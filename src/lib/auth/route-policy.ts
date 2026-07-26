/**
 * Authentication routes that must be reachable before a customer has a
 * session. Keep this exact: adjacent/deeper login routes stay protected.
 */
export function isExactPublicAuthPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  const [, section, id, extra] = parts;

  return section === 'login' && (!id || (id === 'verify' && !extra));
}

/**
 * Resolve a safe post-login destination from the current query string.
 * Authentication pages are never valid destinations because they create a
 * redirect loop after a session is established.
 */
export function resolvePostLoginTarget(locale: string, search: string): string {
  const fallback = `/${locale}/dashboard`;

  try {
    const callbackUrl = new URLSearchParams(search).get('callbackUrl')?.trim() || '';

    // Only same-origin relative paths are accepted.
    if (
      !callbackUrl.startsWith('/') ||
      callbackUrl.startsWith('//') ||
      callbackUrl.includes('\\')
    ) {
      return fallback;
    }

    const parsed = new URL(callbackUrl, 'https://tsh.invalid');
    if (parsed.origin !== 'https://tsh.invalid') return fallback;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const [, section] = parts;
    if (section === 'login') return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
