import { getRequestConfig } from 'next-intl/server';

export const locales = ['ar', 'en', 'ckb', 'kmr', 'tm'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ar';

export const localeNames: Record<Locale, string> = {
  ar: 'العربية',
  en: 'English',
  ckb: 'کوردی سۆرانی',
  kmr: 'کوردی کرمانجی',
  tm: 'Türkmençe',
};

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  ar: 'rtl',
  en: 'ltr',
  ckb: 'rtl',
  kmr: 'rtl',
  tm: 'ltr',
};

/**
 * BCP47 language tag for the server-rendered <html lang>. Our route segment "tm"
 * is a UI alias for Turkmen; the valid BCP47 subtag is "tk", so it must be mapped
 * (ar/en/ckb/kmr are already valid BCP47 subtags and pass through unchanged).
 */
export const localeToBcp47: Record<Locale, string> = {
  ar: 'ar',
  en: 'en',
  ckb: 'ckb',
  kmr: 'kmr',
  tm: 'tk',
};

type MessageTree = { [key: string]: string | MessageTree };

/**
 * Deep-merge a locale's messages over the Arabic base.
 *
 * WHY: next-intl renders the LITERAL KEY PATH when a message is missing, so a gap
 * in ckb/kmr/tm shows the customer text like "products.sortOptions.newest" inside
 * the sort dropdown. The Kurdish and Turkmen files were 148 keys behind ar/en,
 * which put raw keys on the default sort option, the "New" badge, the per-page
 * selector, the whole header-search dropdown and the shop hero.
 *
 * Arabic is the correct fallback for every one of these locales (all are Iraqi
 * markets and Odoo itself only carries en_US + ar_001 — see localeToOdooLang).
 * Translations still override the fallback key-by-key as they land.
 */
function mergeMessages(base: MessageTree, override: MessageTree): MessageTree {
  const merged: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? mergeMessages(current, value)
        : value;
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // This is called for every request, we use the locale from the request
  const locale = await requestLocale;
  const fallbackMessages = (await import(`../messages/${defaultLocale}.json`)).default as MessageTree;

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !locales.includes(locale as Locale)) {
    return {
      locale: defaultLocale,
      messages: fallbackMessages,
    };
  }

  if (locale === defaultLocale) {
    return { locale, messages: fallbackMessages };
  }

  const messages = (await import(`../messages/${locale}.json`)).default as MessageTree;
  return {
    locale,
    messages: mergeMessages(fallbackMessages, messages),
  };
});

// ============================================
// Odoo data-language mapping (added 2026-07-09)
// Odoo has ONLY en_US + ar_001 installed. Kurdish/Turkmen UI locales
// fall back to Arabic data (closest available for Iraqi customers).
// ============================================
export function localeToOdooLang(locale: string): 'en_US' | 'ar_001' {
  return locale === 'en' ? 'en_US' : 'ar_001';
}
