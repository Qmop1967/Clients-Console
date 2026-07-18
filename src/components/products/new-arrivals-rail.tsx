"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedName } from "@/lib/product-name";
import { ProductImage } from "./product-image";
import { formatCurrency } from "@/lib/utils/format";
import { useCart } from "@/components/providers/cart-provider";
import { useCatalogMode } from "@/components/providers/catalog-mode-provider";
import { Sparkles, ChevronLeft, ShoppingCart, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface RailProduct {
  item_id: string;
  name: string;
  localized_names?: { ar?: string; ckb?: string; kmr?: string; tm?: string };
  sku?: string;
  rate: number;
  image_url?: string | null;
  inPriceList?: boolean;
  available_stock?: number;
  unit?: string;
}

/**
 * NewArrivalsRail — horizontal showcase of the newest in-stock products.
 * Scrolls internally (scrollbar-hide). "View all" smooth-scrolls to the full
 * product grid (#all-products). Hidden by the parent when searching/filtering.
 *
 * 2026-07-17: rail cards now carry a stock chip + one-tap quick-add so the
 * rail sells directly instead of only linking out (B2B: fewer taps per line).
 */
function RailCard({
  product,
  currencyCode,
  locale,
}: {
  product: RailProduct;
  currencyCode: string;
  locale: string;
}) {
  const t = useTranslations("products");
  const { addItem } = useCart();
  const { isCatalogMode } = useCatalogMode();
  const [added, setAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = getLocalizedName(product, locale);
  const hasPrice = product.inPriceList !== false && product.rate > 0;
  const inStock = (product.available_stock ?? 0) > 0;
  const lowStock = inStock && (product.available_stock ?? 0) <= 5;
  const canQuickAdd = !isCatalogMode && hasPrice && inStock;

  const handleQuickAdd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canQuickAdd) return;
      addItem(
        {
          item_id: product.item_id,
          name: product.name,
          sku: product.sku || "",
          rate: product.rate,
          image_url: product.image_url || null,
          available_stock: product.available_stock ?? 0,
          unit: product.unit || "Unit",
        },
        1
      );
      setAdded(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAdded(false), 1200);
    },
    [addItem, canQuickAdd, product]
  );

  return (
    <Link
      prefetch={false}
      href={`/${locale}/shop/${product.item_id}`}
      className="group shrink-0 w-40 sm:w-44 rounded-2xl border bg-card overflow-hidden native-press hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative overflow-hidden">
        <ProductImage
          src={product.image_url}
          alt={displayName}
          className="aspect-square"
          sizes="176px"
        />
        <span className="absolute top-2 start-2 px-2 py-0.5 text-[10px] font-bold rounded-full gradient-gold text-white shadow">
          {t("newBadge")}
        </span>

        {/* Stock chip — the trader's first question answered on sight */}
        <span
          className={cn(
            "absolute bottom-2 start-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold backdrop-blur-sm",
            lowStock
              ? "bg-amber-500/85 text-white"
              : "bg-emerald-600/85 text-white"
          )}
        >
          <span className="h-1 w-1 rounded-full bg-white/90" />
          {lowStock ? t("lowStock") : t("inStock")}
        </span>

        {/* One-tap quick add (qty=1); stepper lives on the grid card / detail page */}
        {canQuickAdd && (
          <button
            type="button"
            onClick={handleQuickAdd}
            aria-label={t("addToCart")}
            title={t("addToCart")}
            className={cn(
              "absolute bottom-2 end-2 flex h-8 w-8 items-center justify-center rounded-xl shadow-md transition-all native-press",
              added
                ? "bg-emerald-600 text-white"
                : "bg-background/90 text-foreground backdrop-blur-sm border border-border/60 hover:bg-gold hover:text-white hover:border-gold"
            )}
          >
            {added ? (
              <Check className="h-4 w-4 animate-scale-in" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <div className="p-2.5 space-y-1">
        <h3 className="text-xs font-semibold line-clamp-2 min-h-[2rem] group-hover:text-primary transition-colors">
          {displayName}
        </h3>
        {!isCatalogMode && hasPrice ? (
          <span className="price-tag text-sm text-primary">
            {formatCurrency(product.rate, currencyCode)}
          </span>
        ) : !isCatalogMode ? (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            {t("contactForPrice")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function NewArrivalsRail({
  products,
  currencyCode,
}: {
  products: RailProduct[];
  currencyCode: string;
}) {
  const t = useTranslations("products");
  const locale = useLocale();

  if (!products || products.length === 0) return null;

  const scrollToGrid = () => {
    document.getElementById("all-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="new-arrivals" className="space-y-3 scroll-mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full gradient-gold text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-lg font-bold">{t("newArrivals")}</h2>
        </div>
        <button
          type="button"
          onClick={scrollToGrid}
          className="text-sm font-medium text-primary hover:underline flex items-center gap-0.5 native-press"
        >
          {t("viewAll")}
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>

      {/* Rail */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mb-2">
        {products.map((p) => (
          <RailCard key={p.item_id} product={p} currencyCode={currencyCode} locale={locale} />
        ))}
      </div>
    </section>
  );
}
