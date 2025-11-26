"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, Trash2, Plus, Minus, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CartPage() {
  const t = useTranslations("cart");
  const tProducts = useTranslations("products");
  const { locale } = useParams();
  const { items, itemCount, subtotal, currencyCode, removeItem, updateQuantity, clearCart } = useCart();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IQ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t("empty")}</h2>
        <Link href={`/${locale}/shop`}>
          <Button>
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
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button variant="outline" size="sm" onClick={clearCart}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t("clear")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.item_id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.sku}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.item_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                          disabled={item.quantity >= item.available_stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          ({tProducts("stockCount", { count: item.available_stock })})
                        </span>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(item.rate * item.quantity)} {currencyCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.rate)} {currencyCode} / {item.unit || "unit"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>{t("total")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("subtotal")} ({itemCount} {t("item")}{itemCount > 1 ? "s" : ""})
                </span>
                <span className="font-medium">
                  {formatCurrency(subtotal)} {currencyCode}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t("total")}</span>
                <span>
                  {formatCurrency(subtotal)} {currencyCode}
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button className="w-full" size="lg">
                {t("checkout")}
              </Button>
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
