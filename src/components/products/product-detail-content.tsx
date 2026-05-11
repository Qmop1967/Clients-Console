"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductImage } from "./product-image";
import { ProductGallery } from "./product-gallery";
import { useCart } from "@/components/providers/cart-provider";
import { useCatalogMode } from "@/components/providers/catalog-mode-provider";
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
  MessageCircle,
  AlertCircle,
  Minus,
  Plus,
  Layers,
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
    minimum_quantity?: number;
  };
  locale: string;
}

export function ProductDetailContent({ product, locale }: ProductDetailProps) {
  const t = useTranslations("products");
  const tCart = useTranslations("cart");
  const tCommon = useTranslations("common");
  const tCatalog = useTranslations("catalogMode");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [minimumQtyError, setMinimumQtyError] = useState<string | null>(null);
  const { addItem, getItemQuantity } = useCart();
  const { isCatalogMode, showCatalogModal } = useCatalogMode();

  const isInStock = product.available_stock > 0;
  const isLowStock = product.available_stock > 0 && product.available_stock <= 5;
  const hasPrice = product.inPriceList && product.rate > 0;
  const currentCartQuantity = getItemQuantity(product.item_id);
  const maxQuantity = Math.max(0, product.available_stock - currentCartQuantity);

  // Smart stock label
  const stockLabel = !isInStock
    ? t("outOfStock")
    : product.available_stock <= 5
    ? t("lowStock")
    : t("stockCount", { count: product.available_stock });
  const stockColor = !isInStock
    ? "text-red-500"
    : product.available_stock <= 5
    ? "text-amber-500"
    : product.available_stock <= 20
    ? "text-yellow-500"
    : "text-green-500 dark:text-green-400";

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
  };

  const handleAddToCart = () => {
    if (!hasPrice || !isInStock || maxQuantity <= 0) return;

    setMinimumQtyError(null);

    const result = addItem(
      {
        item_id: product.item_id,
        name: product.name,
        sku: product.sku,
        rate: product.rate,
        image_url: product.image_url,
        available_stock: product.available_stock,
        unit: product.unit,
        minimum_quantity: product.minimum_quantity,
      },
      quantity
    );

    if (result.hasError) {
      setMinimumQtyError(
        tCart("minimumQuantityError", {
          quantity: result.minimumQuantity || 1,
          unit: product.unit,
        })
      );
      setTimeout(() => setMinimumQtyError(null), 5000);
      return;
    }

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

  // Whether to show the sticky bar (mobile only, when product is purchasable)
  const showStickyBar = !isCatalogMode && hasPrice && isInStock;

  // IntersectionObserver: hide sticky bar when main quantity section is visible
  const quantitySectionRef = useRef<HTMLDivElement>(null);
  const [isStickyVisible, setIsStickyVisible] = useState(false);

  useEffect(() => {
    if (!showStickyBar) return;
    const el = quantitySectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar when quantity section is NOT visible
        setIsStickyVisible(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showStickyBar]);

  return (
    <>
      <div className={cn("space-y-6", showStickyBar && "pb-20 lg:pb-0")}>
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/${locale}/shop`} className="hover:text-foreground transition-colors">
            {tCommon("shop")}
          </Link>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          {product.category_name && (
            <>
              <span className="hover:text-foreground transition-colors cursor-pointer truncate max-w-[120px]">
                {product.category_name}
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            </>
          )}
          <span className="text-foreground font-medium truncate max-w-[160px]">
            {product.name}
          </span>
        </nav>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="relative">
              <ProductGallery
                productId={product.item_id}
                productName={product.name}
                fallbackImageUrl={product.image_url}
              />

              {/* Stock Badge overlay */}
              {!isCatalogMode && (
                <Badge
                  variant={isInStock ? "success" : "destructive"}
                  className={cn(
                    "absolute right-3 top-3 z-10 text-sm px-3 py-1 shadow-md",
                    isLowStock && "animate-pulse"
                  )}
                >
                  {stockLabel}
                </Badge>
              )}

              {/* Wishlist overlay */}
              <div className="absolute left-3 top-3 z-10">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full shadow-md"
                  aria-label="Add to wishlist"
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Trust Badges - Desktop: horizontal cards */}
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
          <div className="space-y-5">
            {/* Category Chip */}
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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
              {product.name}
            </h1>

            {/* SKU + Stock + Unit — compact info row (single source, no duplication) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <button
                onClick={handleCopySku}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>SKU: {product.sku}</span>
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              {!isCatalogMode && (
                <>
                  <span className="text-border">|</span>
                  <span className={cn("font-medium", stockColor)}>
                    {stockLabel}
                  </span>
                </>
              )}
              <span className="text-border">|</span>
              <span className="text-muted-foreground">{product.unit}</span>
            </div>

            {/* Price Section */}
            {!isCatalogMode && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                {hasPrice ? (
                  <div>
                    <span className="text-3xl md:text-4xl font-bold text-primary">
                      {formatCurrency(product.rate, product.currencyCode)}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-muted-foreground">
                      {t("contactForPrice")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("contactForPriceDescription")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">{t("description")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Specifications Table */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                {t("specifications")}
              </h3>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="divide-y divide-border/50">
                  {product.category_name && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                      <span className="text-xs text-muted-foreground">{t("category")}</span>
                      <span className="text-sm font-medium">{product.category_name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{t("unit")}</span>
                    <span className="text-sm font-medium">{product.unit}</span>
                  </div>
                  {product.brand && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                      <span className="text-xs text-muted-foreground">{t("brand")}</span>
                      <span className="text-sm font-medium">{product.brand}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">SKU</span>
                    <span className="text-sm font-medium tabular-nums">{product.sku}</span>
                  </div>
                  {!isCatalogMode && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                      <span className="text-xs text-muted-foreground">{t("availability")}</span>
                      <span className={cn("text-sm font-medium", stockColor)}>{stockLabel}</span>
                    </div>
                  )}
                  {product.minimum_quantity && product.minimum_quantity > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{t("minimumOrder")}</span>
                      <span className="text-sm font-medium">{product.minimum_quantity} {product.unit}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Catalog Mode CTA */}
            {isCatalogMode && (
              <Card className="border-2 border-primary/20">
                <CardContent className="p-5 space-y-4 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-muted-foreground">
                    {tCatalog("catalogModeDescription")}
                  </p>
                  <Button
                    className="w-full h-14 text-lg font-semibold rounded-xl gradient-primary hover:opacity-90"
                    onClick={showCatalogModal}
                    size="lg"
                  >
                    <MessageCircle className="h-5 w-5" />
                    {tCatalog("contactSales")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Minimum Quantity Error Alert */}
            {minimumQtyError && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{tCart("minimumQuantityNotMet")}</AlertTitle>
                <AlertDescription>{minimumQtyError}</AlertDescription>
              </Alert>
            )}

            {/* Quantity Section — DESKTOP ONLY (mobile uses sticky bar) */}
            {!isCatalogMode && hasPrice && isInStock && (
              <div className="hidden lg:block space-y-4">
                {/* Minimum Quantity Info */}
                {product.minimum_quantity && product.minimum_quantity > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {tCart("minimumQuantityRequired", {
                        quantity: product.minimum_quantity,
                        unit: product.unit,
                      })}
                    </Badge>
                  </div>
                )}

                {/* Wholesale Quantity Input */}
                <WholesaleQuantityInput
                  value={quantity}
                  onChange={handleQuantityChange}
                  max={maxQuantity}
                  translations={{
                    max: t("maxQuantity"),
                    available: t("availableStock"),
                    exceededMax: t("exceededMaxQuantity", { count: maxQuantity }),
                  }}
                />

                {/* Already in cart notice */}
                {currentCartQuantity > 0 && (
                  <div className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                    <ShoppingCart className="h-4 w-4" />
                    {t("alreadyInCart", { count: currentCartQuantity })}
                  </div>
                )}

                {/* Total + Add to Cart */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-lg font-semibold">{tCart("total")}</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(product.rate * quantity, product.currencyCode)}
                  </span>
                </div>

                <Button
                  onClick={handleAddToCart}
                  disabled={added || maxQuantity <= 0}
                  className={cn(
                    "w-full h-14 text-lg font-semibold rounded-xl transition-all duration-300",
                    added
                      ? "bg-green-600 hover:bg-green-600"
                      : "gradient-primary hover:opacity-90 text-white"
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
              </div>
            )}

            {/* Quantity Section — MOBILE inline (above sticky bar) */}
            {!isCatalogMode && hasPrice && isInStock && (
              <div ref={quantitySectionRef} className="lg:hidden space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground text-center">
                  {t("wholesaleQuantity") || "اختيار كمية الجملة"}
                </h3>
                {/* Minimum Quantity Info */}
                {product.minimum_quantity && product.minimum_quantity > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {tCart("minimumQuantityRequired", {
                        quantity: product.minimum_quantity,
                        unit: product.unit,
                      })}
                    </Badge>
                  </div>
                )}

                {/* Wholesale Quantity Input — compact */}
                <WholesaleQuantityInput
                  value={quantity}
                  onChange={handleQuantityChange}
                  max={maxQuantity}
                  translations={{
                    max: t("maxQuantity"),
                    available: t("availableStock"),
                    exceededMax: t("exceededMaxQuantity", { count: maxQuantity }),
                  }}
                />

                {/* Already in cart notice */}
                {currentCartQuantity > 0 && (
                  <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {t("alreadyInCart", { count: currentCartQuantity })}
                  </div>
                )}
              </div>
            )}

            {/* Contact for Price CTA */}
            {!isCatalogMode && !hasPrice && (
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
            {!isCatalogMode && !isInStock && hasPrice && (
              <Card className="border-red-500/50 bg-red-500/10">
                <CardContent className="p-5">
                  <p className="text-red-600 dark:text-red-400">
                    {t("outOfStockDescription")}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Trust Badges — Mobile: compact horizontal strip */}
            <div className="lg:hidden flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex-1 flex flex-col items-center gap-1 text-center">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-medium leading-tight">{t("fastDelivery")}</span>
              </div>
              <div className="w-px h-8 bg-border/50" />
              <div className="flex-1 flex flex-col items-center gap-1 text-center">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-medium leading-tight">{t("warranty")}</span>
              </div>
              <div className="w-px h-8 bg-border/50" />
              <div className="flex-1 flex flex-col items-center gap-1 text-center">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-medium leading-tight">{t("genuine")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STICKY BOTTOM PURCHASE BAR — Mobile Only ===== */}
      {showStickyBar && (
        <div className={cn(
          "fixed bottom-[60px] inset-x-0 z-40 lg:hidden border-t border-border/50 bg-background/98 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90 safe-area-bottom",
          "transition-transform duration-300 ease-out",
          isStickyVisible ? "translate-y-0" : "translate-y-full"
        )}>
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Compact quantity stepper */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="h-8 w-8 flex items-center justify-center rounded-lg border bg-muted/50 text-foreground disabled:opacity-40 transition-colors active:bg-muted"
                aria-label="Decrease"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center text-sm font-semibold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                disabled={quantity >= maxQuantity}
                className="h-8 w-8 flex items-center justify-center rounded-lg border bg-muted/50 text-foreground disabled:opacity-40 transition-colors active:bg-muted"
                aria-label="Increase"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Total price */}
            <div className="flex-1 text-center min-w-0">
              <span className="text-base font-bold text-primary tabular-nums whitespace-nowrap">
                {formatCurrency(product.rate * quantity, product.currencyCode)}
              </span>
            </div>

            {/* Add to cart button */}
            <Button
              onClick={handleAddToCart}
              disabled={added || maxQuantity <= 0}
              className={cn(
                "h-10 px-5 text-sm font-semibold rounded-xl transition-all duration-300 shrink-0",
                added
                  ? "bg-green-600 hover:bg-green-600"
                  : "gradient-primary hover:opacity-90 text-white"
              )}
            >
              {added ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  {t("addedToCart")}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4" />
                  {t("addToCart")}
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Sticky bar for out-of-stock products — Mobile Only */}
      {!isCatalogMode && hasPrice && !isInStock && (
        <div className="fixed bottom-[60px] inset-x-0 z-40 lg:hidden border-t border-border/50 bg-background/98 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90 safe-area-bottom">
          <div className="flex items-center justify-center px-4 py-3">
            <Button
              disabled
              className="w-full h-10 text-sm font-semibold rounded-xl opacity-60"
              variant="secondary"
            >
              {t("outOfStock")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
