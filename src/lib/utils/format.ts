/**
 * Shared formatting utilities for consistent number and currency display
 * This eliminates duplication across 8+ components
 */

// Locale configuration for Iraq region
export const LOCALE_CONFIG = {
  en: {
    intl: "en-IQ" as const,
    dir: "ltr" as const,
  },
  ar: {
    intl: "ar-IQ" as const,
    dir: "rtl" as const,
  },
} as const;

export type SupportedLocale = keyof typeof LOCALE_CONFIG;

/**
 * Format a number as currency with the appropriate locale settings
 * @param amount - The number to format
 * @param currencyCode - Optional currency code to append (e.g., "IQD", "USD")
 * @param locale - The locale to use for formatting (defaults to "en")
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currencyCode?: string,
  locale: SupportedLocale = "en"
): string {
  // IQD (Iraqi Dinar) uses 0 decimals, USD and other currencies use 2
  const decimals = currencyCode === "IQD" ? 0 : 2;
  const intlLocale = locale === "ar" ? "ar-IQ" : "en-US";

  const formatted = new Intl.NumberFormat(intlLocale, {
    style: "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}

/**
 * Format a number with decimal places
 * @param amount - The number to format
 * @param decimals - Number of decimal places (default 2)
 * @param locale - The locale to use for formatting
 */
export function formatNumber(
  amount: number,
  decimals: number = 2,
  locale: SupportedLocale = "en"
): string {
  const intlLocale = LOCALE_CONFIG[locale]?.intl || "en-IQ";

  return new Intl.NumberFormat(intlLocale, {
    style: "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a date string for display
 * @param date - Date string or Date object
 * @param locale - The locale to use for formatting
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  locale: SupportedLocale = "en"
): string {
  const intlLocale = LOCALE_CONFIG[locale]?.intl || "en-IQ";

  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Format a date with time
 * @param date - Date string or Date object
 * @param locale - The locale to use for formatting
 */
export function formatDateTime(
  date: string | Date,
  locale: SupportedLocale = "en"
): string {
  const intlLocale = LOCALE_CONFIG[locale]?.intl || "en-IQ";

  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * @param date - Date string or Date object
 * @param locale - The locale to use for formatting
 */
export function formatRelativeTime(
  date: string | Date,
  locale: SupportedLocale = "en"
): string {
  const intlLocale = LOCALE_CONFIG[locale]?.intl || "en-IQ";
  const now = new Date();
  const target = new Date(date);
  const diffInSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });

  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "week", seconds: 604800 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 },
  ];

  for (const { unit, seconds } of units) {
    const value = Math.floor(Math.abs(diffInSeconds) / seconds);
    if (value >= 1) {
      return rtf.format(diffInSeconds > 0 ? value : -value, unit);
    }
  }

  return rtf.format(0, "second");
}

/**
 * Format a percentage value
 * @param value - The decimal value (0.25 = 25%)
 * @param locale - The locale to use for formatting
 */
export function formatPercentage(
  value: number,
  locale: SupportedLocale = "en"
): string {
  const intlLocale = LOCALE_CONFIG[locale]?.intl || "en-IQ";

  return new Intl.NumberFormat(intlLocale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}
