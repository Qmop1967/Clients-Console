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

export default getRequestConfig(async ({ requestLocale }) => {
  // This is called for every request, we use the locale from the request
  const locale = await requestLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !locales.includes(locale as Locale)) {
    return {
      locale: defaultLocale,
      messages: (await import(`../messages/${defaultLocale}.json`)).default,
    };
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
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
