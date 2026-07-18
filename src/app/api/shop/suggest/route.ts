// ============================================
// Shop search suggestions — /api/shop/suggest?q=…&lang=ar
// ============================================
// Powers the always-visible header search. Returns light product/category
// hits (names + SKU only — no prices, no stock numbers).
//
// QUOTA SAFETY: reuses the SAME unstable_cache entry the shop page warms
// (getProductsWithPricesCached, CONSUMER tier) — a typing burst costs zero
// extra gateway calls within the 60s revalidate window.
//
// MATCHING: normalized Arabic comparison tolerant of the common Iraqi
// spelling variants (قيمنق/كيمنك/جيمنج، كامرات/كاميرات، أ/ا، ة/ه، ى/ي)
// plus SKU prefix/substring matching.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getProductsWithPricesCached, getCategoriesCached } from "@/lib/odoo/products";
import { PRICE_LIST_IDS } from "@/lib/odoo/pricelists";
import { localeToOdooLang } from "@/i18n/config";
import { getLocalizedName } from "@/lib/product-name";

export const dynamic = "force-dynamic";

const MAX_PRODUCTS = 8;
const MAX_CATEGORIES = 3;

/** Arabic-tolerant normalization for search matching. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ڤﭬ]/g, "ف")
    .replace(/[گݣ]/g, "ك")
    .replace(/چ/g, "ج")
    // Iraqi transliteration tolerance: ق and ك both used for the G sound
    // (قيمنق/كيمنك). Folding ق→ك makes either spelling find the other.
    .replace(/ق/g, "ك")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const locale = searchParams.get("lang") === "en" ? "en" : "ar";

  if (q.length < 2 || q.length > 60) {
    return NextResponse.json({ products: [], categories: [] });
  }

  try {
    const odooLang = localeToOdooLang(locale);
    const [productResult, categories] = await Promise.all([
      getProductsWithPricesCached(PRICE_LIST_IDS.CONSUMER, odooLang),
      getCategoriesCached(odooLang),
    ]);

    const nq = normalize(q);
    const nqSku = q.toLowerCase();

    const inStock = productResult.products.filter(
      (p) => (p.available_stock ?? 0) > 0
    );

    // Rank: SKU prefix > SKU substring > name substring
    const scored: { score: number; id: string; name: string; sku: string }[] = [];
    for (const p of inStock) {
      const sku = (p.sku || "").toLowerCase();
      const displayName = getLocalizedName(p, locale);
      const nName = normalize(`${displayName} ${p.name}`);
      let score = -1;
      if (sku && sku.startsWith(nqSku)) score = 3;
      else if (sku && sku.includes(nqSku)) score = 2;
      else if (nName.includes(nq)) score = 1;
      if (score > 0) {
        scored.push({ score, id: p.item_id, name: displayName, sku: p.sku || "" });
        if (scored.length >= 60) break; // plenty to rank from
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const products = scored.slice(0, MAX_PRODUCTS).map(({ id, name, sku }) => ({ id, name, sku }));

    // Categories: only ones that actually have in-stock products behind them
    const stockedCategoryIds = new Set(
      inStock.map((p) => p.category_id).filter(Boolean) as string[]
    );
    const matchedCategories = categories
      .filter(
        (c) =>
          c.is_active &&
          stockedCategoryIds.has(c.category_id) &&
          normalize(c.name).includes(nq)
      )
      .slice(0, MAX_CATEGORIES)
      .map((c) => ({ id: c.category_id, name: c.name }));

    return NextResponse.json(
      { products, categories: matchedCategories },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch (error) {
    console.error("[Suggest] error:", error);
    return NextResponse.json({ products: [], categories: [] }, { status: 200 });
  }
}
