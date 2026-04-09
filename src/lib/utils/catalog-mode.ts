/**
 * Catalog Mode Utility
 *
 * When enabled, the store operates in view-only mode:
 * - Prices are hidden
 * - Stock quantities are hidden
 * - Order creation is disabled
 * - Customers are directed to contact sales representatives
 *
 * Toggle: Set NEXT_PUBLIC_CATALOG_MODE=true in environment variables
 */

/**
 * Check if catalog mode is enabled
 * Works in both server and client components
 */
export function isCatalogModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CATALOG_MODE === "true";
}

/**
 * Standard error response for catalog mode
 * Used by checkout APIs to return consistent error messages
 */
export const CATALOG_MODE_ERROR = {
  error: "CATALOG_MODE",
  message: "Orders are currently disabled. Please contact your sales representative.",
  message_ar: "الطلبات معطلة حالياً. يرجى التواصل مع ممثل المبيعات الخاص بكم.",
} as const;
