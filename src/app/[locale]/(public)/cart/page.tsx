"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useCart } from "@/components/providers/cart-provider";
import { useCatalogMode } from "@/components/providers/catalog-mode-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Package,
  Phone,
  Loader2,
  CheckCircle,
  LogIn,
  MessageCircle,
} from "lucide-react";
import { WholesaleQuantityInput } from "@/components/ui/wholesale-quantity-input";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CartPage() {
  const t = useTranslations("cart");
  const tProducts = useTranslations("products");
  const tCommon = useTranslations("common");
  const tCatalog = useTranslations("catalogMode");
  const { locale } = useParams();
  const { data: session, status } = useSession();
  const { items, currencyCode, removeItem, updateQuantity, clearCart } = useCart();
  const { isCatalogMode, showCatalogModal } = useCatalogMode();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderNumber: string;
    orderId: string;
  } | null>(null);

  const isAuthenticated = status === "authenticated" && !!session?.user?.zohoContactId;

  // Separate valid and invalid items
  const { validItems, invalidItems, validSubtotal, validItemCount } = useMemo(() => {
    const valid = items.filter(item => item.rate > 0);
    const invalid = items.filter(item => item.rate <= 0);
    const subtotal = valid.reduce((sum, item) => sum + item.rate * item.quantity, 0);
    const count = valid.reduce((sum, item) => sum + item.quantity, 0);
    return { validItems: valid, invalidItems: invalid, validSubtotal: subtotal, validItemCount: count };
  }, [items]);

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const canCheckout = isAuthenticated && validItems.length > 0 && invalidItems.length === 0;

  // Format currency - show decimals for small amounts in IQD
  const formatCurrency = (amount: number, forceDecimals = false) => {
    // For IQD: show decimals only if amount is small (< 10) or forced
    const needsDecimals = currencyCode === "IQD"
      ? (amount > 0 && amount < 10) || forceDecimals
      : true;
    const decimals = needsDecimals ? 2 : 0;

    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  };

  // Format unit price - always show precision for unit prices
  const formatUnitPrice = (rate: number) => {
    if (rate <= 0) return "0";
    // Always show at least 2 decimals for unit prices to avoid confusion
    const decimals = currencyCode === "IQD" ? (rate < 1 ? 2 : (rate < 10 ? 1 : 0)) : 2;
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(rate);
  };

  // Handle checkout
  const handleCheckout = async () => {
    if (!canCheckout) return;

    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: validItems.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity,
            rate: item.rate,
            name: item.name,
            sku: item.sku,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      // Success!
      setOrderSuccess({
        orderNumber: data.order.salesorder_number,
        orderId: data.order.salesorder_id,
      });

      // Clear the cart
      clearCart();

    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Order success view
  if (orderSuccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6">
          <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">
            {t("orderPlaced")}
          </h2>
          <p className="text-muted-foreground max-w-sm">
            {t("orderPlacedDescription")}
          </p>
          <p className="text-lg font-semibold mt-4">
            {t("orderNumber")}: <span className="text-primary">{orderSuccess.orderNumber}</span>
          </p>
        </div>
        <div className="flex gap-3 mt-4">
          <Link href={`/${locale}/orders/${orderSuccess.orderId}`}>
            <Button>
              {t("viewOrder")}
            </Button>
          </Link>
          <Link href={`/${locale}/orders`}>
            <Button variant="outline">
              {t("viewAllOrders")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Catalog Mode view - orders temporarily disabled
  if (isCatalogMode) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4">
        <div className="rounded-full bg-primary/10 p-6">
          <MessageCircle className="h-12 w-12 text-primary" />
        </div>
        <div className="text-center space-y-4" dir="rtl">
          <h2 className="text-2xl font-semibold">{tCatalog("title")}</h2>
          <p className="text-muted-foreground max-w-md whitespace-pre-line">
            {tCatalog("message")}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={showCatalogModal} variant="gold">
            <MessageCircle className="me-2 h-4 w-4" />
            {tCatalog("contactSales")}
          </Button>
          <Link href={`/${locale}/shop`}>
            <Button variant="outline">
              {t("continueShopping")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4">
        <div className="rounded-full bg-muted p-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">{t("empty")}</h2>
          <p className="text-muted-foreground max-w-sm">
            {t("emptyDescription")}
          </p>
        </div>
        <Link href={`/${locale}/shop`}>
          <Button size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("continueShopping")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {totalItemCount} {t("item")}{totalItemCount > 1 ? "s" : ""} {t("inYourCart")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearCart} className="text-destructive hover:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          {t("clear")}
        </Button>
      </div>

      {/* Login Required Banner */}
      {!isAuthenticated && (
        <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <LogIn className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-800 dark:text-blue-200">
                  {t("loginRequired")}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {t("loginRequiredDescription")}
                </p>
                <Link href={`/${locale}/login`}>
                  <Button size="sm" className="mt-3">
                    <LogIn className="mr-2 h-4 w-4" />
                    {tCommon("login")}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning Banner for Invalid Items */}
      {invalidItems.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-800 dark:text-amber-200">
                  {t("priceUnavailable")}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {t("priceUnavailableDescription")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checkout Error */}
      {checkoutError && (
        <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-800 dark:text-red-200">
                  {t("checkoutError")}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {checkoutError}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Invalid Items Section */}
          {invalidItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-amber-600 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {t("contactForPrice")} ({invalidItems.length})
              </h3>
              {invalidItems.map((item) => (
                <Card key={item.item_id} className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link href={`/${locale}/shop/${item.item_id}`} className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </Link>

                      {/* Details */}
                      <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/${locale}/shop/${item.item_id}`} className="hover:underline">
                              <h3 className="font-medium truncate">{item.name}</h3>
                            </Link>
                            <p className="text-xs text-muted-foreground">{item.sku}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.item_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {t("quantity")}: {item.quantity}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                            {tProducts("contactForPrice")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Valid Items Section */}
          {validItems.length > 0 && (
            <div className="space-y-3">
              {invalidItems.length > 0 && (
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t("readyToOrder")} ({validItems.length})
                </h3>
              )}
              {validItems.map((item) => (
                <Card key={item.item_id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link href={`/${locale}/shop/${item.item_id}`} className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted group">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                            sizes="80px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </Link>

                      {/* Details */}
                      <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/${locale}/shop/${item.item_id}`} className="hover:underline">
                              <h3 className="font-medium truncate">{item.name}</h3>
                            </Link>
                            <p className="text-xs text-muted-foreground">{item.sku}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.item_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-auto pt-3 border-t space-y-3">
                          {/* Price Row */}
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">{formatUnitPrice(item.rate)}</span>
                              <span className="mx-1">×</span>
                              <span>{item.quantity}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">
                                {formatCurrency(item.rate * item.quantity)} {currencyCode}
                              </p>
                            </div>
                          </div>

                          {/* Quantity Controls - Wholesale Input */}
                          <WholesaleQuantityInput
                            value={item.quantity}
                            onChange={(newQuantity) => updateQuantity(item.item_id, newQuantity)}
                            max={item.available_stock}
                            translations={{
                              max: tProducts("maxQuantity"),
                              available: tProducts("availableStock"),
                              exceededMax: tProducts("exceededMaxQuantity", { count: item.available_stock }),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                {t("orderSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item Count */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("items")} ({validItemCount})
                </span>
                <span>
                  {formatCurrency(validSubtotal)} {currencyCode}
                </span>
              </div>

              {/* Invalid Items Warning */}
              {invalidItems.length > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>{t("pendingPrice")} ({invalidItems.reduce((s, i) => s + i.quantity, 0)})</span>
                  <span>--</span>
                </div>
              )}

              <Separator />

              {/* Total */}
              <div className="flex justify-between text-lg font-bold">
                <span>{t("total")}</span>
                <span className="text-primary">
                  {formatCurrency(validSubtotal)} {currencyCode}
                </span>
              </div>

              {invalidItems.length > 0 && (
                <p className="text-xs text-amber-600">
                  * {t("excludesPendingItems")}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-3 pt-2">
              {/* Checkout Button */}
              {isAuthenticated ? (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canCheckout || isCheckingOut}
                  onClick={handleCheckout}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("processing")}
                    </>
                  ) : invalidItems.length > 0 ? (
                    t("removeInvalidFirst")
                  ) : (
                    t("checkout")
                  )}
                </Button>
              ) : (
                <Link href={`/${locale}/login`} className="w-full">
                  <Button className="w-full" size="lg">
                    <LogIn className="mr-2 h-4 w-4" />
                    {t("loginToCheckout")}
                  </Button>
                </Link>
              )}
              <Link href={`/${locale}/shop`} className="w-full">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("continueShopping")}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
