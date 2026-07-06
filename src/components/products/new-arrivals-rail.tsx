"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedName } from "@/lib/product-name";
import { ProductImage } from "./product-image";
import { formatCurrency } from "@/lib/utils/format";
import { Sparkles, ChevronLeft } from "lucide-react";

interface RailProduct {
  item_id: string;
  name: string;
  localized_names?: { ar?: string; ckb?: string; kmr?: string; tm?: string };
  rate: number;
  image_url?: string | null;
  inPriceList?: boolean;
}

/**
 * NewArrivalsRail — horizontal showcase of the newest in-stock products.
 * Scrolls internally (scrollbar-hide). "View all" smooth-scrolls to the full
 * product grid (#all-products). Hidden by the parent when searching/filtering.
 */
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
    <section className="space-y-3">
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
        {products.map((p) => {
          const displayName = getLocalizedName(p, locale);
          const hasPrice = p.inPriceList !== false && p.rate > 0;
          return (
            <Link
              key={p.item_id}
              prefetch={false}
              href={`/${locale}/shop/${p.item_id}`}
              className="group shrink-0 w-40 sm:w-44 rounded-2xl border bg-card overflow-hidden native-press hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative overflow-hidden">
                <ProductImage
                  src={p.image_url}
                  alt={displayName}
                  className="aspect-square"
                  sizes="176px"
                />
                <span className="absolute top-2 start-2 px-2 py-0.5 text-[10px] font-bold rounded-full gradient-gold text-white shadow">
                  {t("newBadge")}
                </span>
              </div>
              <div className="p-2.5 space-y-1">
                <h3 className="text-xs font-semibold line-clamp-2 min-h-[2rem] group-hover:text-primary transition-colors">
                  {displayName}
                </h3>
                {hasPrice ? (
                  <span className="price-tag text-sm text-primary">
                    {formatCurrency(p.rate, currencyCode)}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    {t("contactForPrice")}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
