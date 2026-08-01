/**
 * Region policy for advertising measurement.
 *
 * Where prior consent is legally required (EU/EEA/UK/CH) the pixel stays off until the
 * visitor explicitly accepts. Everywhere else — which is where essentially every TSH
 * customer is — measurement runs on legitimate interest with a visible notice and a
 * one-click opt-out.
 *
 * Fail-safe by design: an unknown country is treated as strict. A missing or unreadable
 * geo header must never silently widen tracking, because that failure is invisible.
 */

/** Countries whose law requires opt-in BEFORE any measurement pixel loads. */
export const PRIOR_CONSENT_REGIONS: ReadonlySet<string> = new Set([
  // EU 27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA non-EU + UK + Switzerland
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

/** Cloudflare returns these when it cannot place the visitor. Treat as strict. */
const UNRESOLVED_COUNTRY_CODES: ReadonlySet<string> = new Set(['XX', 'T1']);

/**
 * True when the visitor must opt in before any pixel may load.
 * Unknown / malformed / unresolved country → true (strict).
 */
export function requiresPriorConsent(country: string | null | undefined): boolean {
  if (!country) return true;
  const code = country.trim().toUpperCase();
  if (code.length !== 2) return true;
  if (UNRESOLVED_COUNTRY_CODES.has(code)) return true;
  return PRIOR_CONSENT_REGIONS.has(code);
}

/** Header Cloudflare sets with the visitor's ISO-3166-1 alpha-2 country. */
export const GEO_COUNTRY_HEADER = 'cf-ipcountry';
