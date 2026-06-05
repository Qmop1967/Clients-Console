// ============================================
// Localized product name resolution
// Localized name (x_name_*) when available for the UI locale,
// otherwise the canonical English name from Odoo.
// ============================================
import type { Product } from "@/types";

type LocalizedKey = "ar" | "ckb" | "kmr" | "tm";

export function getLocalizedName(
  product: Pick<Product, "name" | "localized_names">,
  locale: string
): string {
  if (locale === "en") return product.name;
  const key = locale as LocalizedKey;
  return product.localized_names?.[key] || product.name;
}

/** True when a translated name is shown (useful to render the EN name as subtitle) */
export function hasLocalizedName(
  product: Pick<Product, "name" | "localized_names">,
  locale: string
): boolean {
  if (locale === "en") return false;
  const key = locale as LocalizedKey;
  return Boolean(product.localized_names?.[key]);
}
