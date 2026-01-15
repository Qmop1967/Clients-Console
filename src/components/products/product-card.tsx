"use client";

import { useState, useCallback, memo } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check, Package, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { useCart } from "@/components/providers/cart-provider";
import { useCatalogMode } from "@/components/providers/catalog-mode-provider";

interface ProductCardProps {
  product: {
    item_id: string;
    name: string;
    sku: string;
    rate: number;
    available_stock: number;
    image_url: string | null;
    category_name?: string;
    unit?: string;
  };
  currencyCode: string;
}

// Memoized ProductCard for better performance - prevents unnecessary re-renders
export const ProductCard = memo(function ProductCard({ product, currencyCode }: ProductCardProps) {
  const t = useTranslations("products");
  const tCatalog = useTranslations("catalogMode");
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const { isCatalogMode, showCatalogModal } = useCatalogMode();

  const isInStock = product.available_stock > 0;

  // Memoized add to cart handler
  const handleAddToCart = useCallback(() => {
    addItem({
      item_id: product.item_id,
      name: product.name,
      sku: product.sku,
      rate: product.rate,
      image_url: product.image_url,
      available_stock: product.available_stock,
      unit: product.unit || "unit",
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }, [addItem, product]);

  return (
    <Card
      variant="premium"
      className="group overflow-hidden"
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-muted/50">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Package className="h-12 w-12 text-muted-foreground/30" strokeWidth={1} />
          </div>
        )}

        {/* Hover overlay with quick add */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      <CardContent className="p-4">
        {/* Category (if available) */}
        {product.category_name && (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-500">
            {product.category_name}
          </p>
        )}

        {/* Name - Serif font for luxury */}
        <h2 className="mb-1.5 line-clamp-2 font-display text-base font-medium leading-snug text-foreground">
          {product.name}
        </h2>

        {/* SKU - Subtle */}
        <p className="mb-3 text-xs text-muted-foreground/70">{product.sku}</p>

        {/* Price - Hidden in catalog mode */}
        {!isCatalogMode && (
          <div className="mb-4 flex items-baseline gap-1.5">
            <span className="price-tag text-xl text-foreground">
              {formatCurrency(product.rate, currencyCode)}
            </span>
            {product.unit && (
              <span className="text-xs text-muted-foreground">/ {product.unit}</span>
            )}
          </div>
        )}

        {/* Action Button - Contact Sales in catalog mode, Add to Cart otherwise */}
        {isCatalogMode ? (
          <Button
            onClick={showCatalogModal}
            variant="outline"
            className="w-full"
            size="default"
          >
            <MessageCircle className="h-4 w-4" />
            {tCatalog("contactSales")}
          </Button>
        ) : (
          <Button
            onClick={handleAddToCart}
            disabled={!isInStock || added}
            variant={added ? "success" : "gold"}
            className={cn(
              "w-full transition-all",
              added && "bg-emerald-600 hover:bg-emerald-600"
            )}
            size="default"
          >
            {added ? (
              <>
                <Check className="h-4 w-4" />
                {t("addedToCart")}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                {t("addToCart")}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
});
