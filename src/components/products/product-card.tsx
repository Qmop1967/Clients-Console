"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check, Package } from "lucide-react";
import { cn } from "@/lib/utils/cn";
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

export function ProductCard({ product, currencyCode }: ProductCardProps) {
  const t = useTranslations("products");
  const [added, setAdded] = useState(false);
  const { addItem, isInCart } = useCart();

  const isInStock = product.available_stock > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IQ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddToCart = () => {
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
  };

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      {/* Image */}
      <div className="relative aspect-square bg-muted">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        {/* Stock Badge */}
        <Badge
          variant={isInStock ? "success" : "destructive"}
          className="absolute right-2 top-2"
        >
          {isInStock
            ? `${t("stock")}: ${product.available_stock}`
            : t("outOfStock")}
        </Badge>
      </div>

      <CardContent className="p-3">
        {/* Name */}
        <h3 className="mb-1 line-clamp-2 text-sm font-medium leading-tight">
          {product.name}
        </h3>

        {/* SKU */}
        <p className="mb-2 text-xs text-muted-foreground">{product.sku}</p>

        {/* Price */}
        <div className="mb-3 flex items-baseline gap-1">
          <span className="text-lg font-bold">
            {formatCurrency(product.rate)}
          </span>
          <span className="text-xs text-muted-foreground">{currencyCode}</span>
        </div>

        {/* Add to Cart Button */}
        <Button
          onClick={handleAddToCart}
          disabled={!isInStock || added}
          className={cn(
            "w-full transition-all",
            added && "bg-green-600 hover:bg-green-600"
          )}
          size="sm"
        >
          {added ? (
            <>
              <Check className="mr-1 h-4 w-4" />
              {t("addedToCart")}
            </>
          ) : (
            <>
              <ShoppingCart className="mr-1 h-4 w-4" />
              {t("addToCart")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
