"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "./product-image";
import { useCart } from "@/components/providers/cart-provider";
import {
  ShoppingCart,
  Check,
  Package,
  Tag,
  Box,
  ChevronRight,
  Share2,
  Heart,
  Truck,
  Shield,
  Zap,
  Copy,
  CheckCircle,
} from "lucide-react";
import { WholesaleQuantityInput } from "@/components/ui/wholesale-quantity-input";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

interface ProductDetailProps {
  product: {
    item_id: string;
    name: string;
    sku: string;
    description: string;
    rate: number;
    available_stock: number;
    image_url: string | null;
    category_id?: string;
    category_name?: string;
    brand?: string;
    unit: string;
    inPriceList: boolean;
    currencyCode: string;
  };
  locale: string;
}

export function ProductDetailContent({ product, locale }: ProductDetailProps) {
  const t = useTranslations("products");
  const tCart = useTranslations("cart");
  const tCommon = useTranslations("common");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { addItem, getItemQuantity } = useCart();

  const isInStock = product.available_stock > 0;
  const isLowStock = product.available_stock > 0 && product.available_stock <= 5;
  const hasPrice = product.inPriceList && product.rate > 0;
  const currentCartQuantity = getItemQuantity(product.item_id);
  const maxQuantity = Math.max(0, product.available_stock - currentCartQuantity);

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
  };

  const handleAddToCart = () => {
    if (!hasPrice || !isInStock || maxQuantity <= 0) return;

    addItem(
      {
        item_id: product.item_id,
        name: product.name,
        sku: product.sku,
        rate: product.rate,
        image_url: product.image_url,
        available_stock: product.available_stock,
        unit: product.unit,
      },
      quantity
    );

    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setQuantity(1);
    }, 2000);
  };

  const handleCopySku = async () => {
    await navigator.clipboard.writeText(product.sku);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} at TSH Shop`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${locale}/shop`} className="hover:text-foreground transition-colors">
          {tCommon("shop")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        {product.category_name && (
          <>
            <span className="hover:text-foreground transition-colors cursor-pointer">
              {product.category_name}
            </span>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {product.name}
        </span>
      </nav>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image Section */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="group relative aspect-square overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/50 to-muted">
            <ProductImage
              src={product.image_url}
              alt={product.name}
              className="h-full w-full transition-transform duration-500 group-hover:scale-105"
              priority
            />

            {/* Stock Badge */}
            <Badge
              variant={isInStock ? "success" : "destructive"}
              className={cn(
                "absolute right-4 top-4 text-sm px-3 py-1",
                isLowStock && "animate-pulse"
              )}
            >
              {isInStock
                ? isLowStock
                  ? t("lowStock")
                  : t("stockCount", { count: product.available_stock })
                : t("outOfStock")}
            </Badge>

            {/* Action Buttons */}
            <div className="absolute left-4 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
              >
                <Heart className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Trust Badges - Desktop */}
          <div className="hidden lg:grid grid-cols-3 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xs">
                  <p className="font-medium">{t("fastDelivery")}</p>
                  <p className="text-muted-foreground">{t("fastDeliveryDesc")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xs">
                  <p className="font-medium">{t("warranty")}</p>
                  <p className="text-muted-foreground">{t("warrantyDesc")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xs">
                  <p className="font-medium">{t("genuine")}</p>
                  <p className="text-muted-foreground">{t("genuineDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Product Info Section */}
        <div className="space-y-6">
          {/* Category & Brand Badges */}
          <div className="flex flex-wrap gap-2">
            {product.category_name && (
              <Badge variant="outline" className="text-xs">
                <Tag className="h-3 w-3 me-1" />
                {product.category_name}
              </Badge>
            )}
            {product.brand && (
              <Badge variant="secondary" className="text-xs">
                <Box className="h-3 w-3 me-1" />
                {product.brand}
              </Badge>
            )}
          </div>

          {/* Product Name */}
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
              {product.name}
            </h1>
            <button
              onClick={handleCopySku}
              className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>SKU: {product.sku}</span>
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Price Section */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
            {hasPrice ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("price")}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">
                    {formatCurrency(product.rate, product.currencyCode)}
                  </span>
                  <span className="text-sm text-muted-foreground">/ {product.unit}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-muted-foreground">
                  {t("contactForPrice")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("contactForPriceDescription")}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="font-semibold">{t("description")}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Product Specs */}
          <div className="space-y-3">
            <h3 className="font-semibold">{t("specifications")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("unit")}</p>
                  <p className="font-medium">{product.unit}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Box className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("availability")}</p>
                  <p className={cn(
                    "font-medium",
                    isInStock ? "text-green-600 dark:text-green-400" : "text-red-500"
                  )}>
                    {isInStock ? t("inStock") : t("outOfStock")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Add to Cart Section */}
          {hasPrice && isInStock && (
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
              <CardContent className="p-5 space-y-5">
                {/* Quantity Header */}
                <div className="text-center">
                  <span className="text-sm font-medium text-muted-foreground">{tCart("quantity")}</span>
                </div>

                {/* Wholesale Quantity Input */}
                <WholesaleQuantityInput
                  value={quantity}
                  onChange={handleQuantityChange}
                  max={maxQuantity}
                  translations={{
                    max: t("maxQuantity"),
                    available: t("availableStock"),
                  }}
                />

                {/* Already in cart notice */}
                {currentCartQuantity > 0 && (
                  <div className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                    <ShoppingCart className="h-4 w-4" />
                    {t("alreadyInCart", { count: currentCartQuantity })}
                  </div>
                )}

                <Separator />

                {/* Total */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-lg font-semibold">{tCart("total")}</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(product.rate * quantity, product.currencyCode)}
                  </span>
                </div>

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  disabled={added || maxQuantity <= 0}
                  className={cn(
                    "w-full h-14 text-lg font-semibold rounded-xl transition-all duration-300",
                    added
                      ? "bg-green-600 hover:bg-green-600"
                      : "gradient-primary hover:opacity-90"
                  )}
                  size="lg"
                >
                  {added ? (
                    <span className="flex items-center gap-2 animate-scale-in">
                      <Check className="h-5 w-5" />
                      {t("addedToCart")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      {t("addToCart")}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Contact for Price CTA */}
          {!hasPrice && (
            <Card className="border-yellow-500/50 bg-yellow-500/10">
              <CardContent className="p-5 space-y-3">
                <p className="text-yellow-600 dark:text-yellow-400">
                  {t("contactForPriceDescription")}
                </p>
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/${locale}/login`}>{t("loginToAccount")}</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Out of Stock CTA */}
          {!isInStock && hasPrice && (
            <Card className="border-red-500/50 bg-red-500/10">
              <CardContent className="p-5">
                <p className="text-red-600 dark:text-red-400">
                  {t("outOfStockDescription")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Trust Badges - Mobile */}
          <div className="lg:hidden grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Truck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{t("fastDelivery")}</p>
                <p className="text-xs text-muted-foreground">{t("fastDeliveryDesc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{t("warranty")}</p>
                <p className="text-xs text-muted-foreground">{t("warrantyDesc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{t("genuine")}</p>
                <p className="text-xs text-muted-foreground">{t("genuineDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
