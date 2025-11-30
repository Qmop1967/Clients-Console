"use client";

import { useState, useCallback, memo } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check, Package } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { useCart } from "@/components/providers/cart-provider";

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
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const isInStock = product.available_stock > 0;
  const isLowStock = product.available_stock > 0 && product.available_stock <= 5;

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

        {/* Stock Badge - Refined styling */}
        <Badge
          variant={
            !isInStock
              ? "destructive"
              : isLowStock
              ? "warning"
              : "success"
          }
          className="absolute end-2 top-2 shadow-sm"
        >
          {!isInStock
            ? t("outOfStock")
            : isLowStock
            ? `${t("stock")}: ${product.available_stock}`
            : `${t("stock")}: ${product.available_stock}`}
        </Badge>

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
        <h3 className="mb-1.5 line-clamp-2 font-display text-base font-medium leading-snug text-foreground">
          {product.name}
        </h3>

        {/* SKU - Subtle */}
        <p className="mb-3 text-xs text-muted-foreground/70">{product.sku}</p>

        {/* Price - Prominent with serif font */}
        <div className="mb-4 flex items-baseline gap-1.5">
          <span className="price-tag text-xl text-foreground">
            {formatCurrency(product.rate, currencyCode)}
          </span>
          {product.unit && (
            <span className="text-xs text-muted-foreground">/ {product.unit}</span>
          )}
        </div>

        {/* Add to Cart Button - Gold accent */}
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
      </CardContent>
    </Card>
  );
});
