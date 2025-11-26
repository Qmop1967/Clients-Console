"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShoppingBag, ShoppingCart, User, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/providers/cart-provider";

interface PublicHeaderProps {
  locale: string;
}

export function PublicHeader({ locale }: PublicHeaderProps) {
  const t = useTranslations("common");
  const { itemCount } = useCart();
  const otherLocale = locale === "en" ? "ar" : "en";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href={`/${locale}/shop`} className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">TSH</span>
          <span className="text-sm text-muted-foreground">{t("shop")}</span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          <Link
            href={`/${locale}/cart`}
            className="relative flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-xs"
              >
                {itemCount > 99 ? "99+" : itemCount}
              </Badge>
            )}
          </Link>

          {/* Language Switcher */}
          <Link
            href={`/${otherLocale}/shop`}
            className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
          >
            <Globe className="h-4 w-4" />
          </Link>

          {/* Login Button */}
          <Link
            href={`/${locale}/login`}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <User className="h-4 w-4" />
            <span>{t("login")}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
