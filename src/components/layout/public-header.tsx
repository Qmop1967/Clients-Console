"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { ShoppingCart, User, Globe, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";

interface PublicHeaderProps {
  locale: string;
}

export function PublicHeader({ locale }: PublicHeaderProps) {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const { data: session, status } = useSession();
  const { itemCount } = useCart();
  const otherLocale = locale === "en" ? "ar" : "en";

  const isAuthenticated = status === "authenticated" && !!session?.user;

  // Logo links to /products for authenticated users, /shop for public visitors
  const logoHref = isAuthenticated ? `/${locale}/products` : `/${locale}/shop`;

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo - Luxury styling with serif font */}
        <Link
          href={logoHref}
          className="group flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          {/* Gold accent square */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm">
            <span className="font-display text-lg font-bold text-white">T</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl font-semibold tracking-tight">
              TSH
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("shop")}
            </span>
          </div>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cart - Gold badge accent */}
          <Link
            href={`/${locale}/cart`}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-background/50 transition-all hover:border-amber-500/30 hover:bg-secondary"
            aria-label="Shopping cart"
          >
            <ShoppingCart className="h-5 w-5 text-foreground/80" strokeWidth={1.5} />
            {itemCount > 0 && (
              <Badge
                variant="gold"
                className="absolute -end-1.5 -top-1.5 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-semibold animate-scale-in"
              >
                {itemCount > 99 ? "99+" : itemCount}
              </Badge>
            )}
          </Link>

          {/* Language Switcher */}
          <Link
            href={isAuthenticated ? `/${otherLocale}/products` : `/${otherLocale}/shop`}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-background/50 transition-all hover:border-primary/30 hover:bg-secondary"
            aria-label={`Switch to ${otherLocale === "ar" ? "Arabic" : "English"}`}
          >
            <Globe className="h-5 w-5 text-foreground/80" strokeWidth={1.5} />
          </Link>

          {/* Auth Button - Premium styling */}
          {isAuthenticated ? (
            <Button asChild variant="luxury" size="default">
              <Link href={`/${locale}/dashboard`}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">{tNav("dashboard")}</span>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="gold" size="default">
              <Link href={`/${locale}/login`}>
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{t("login")}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
