"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { ShoppingCart, User, Globe, LayoutDashboard, Sun, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { AccountChip } from "./account-chip";
import { HeaderSearch } from "./header-search";

interface PublicHeaderProps {
  locale: string;
}

export function PublicHeader({ locale }: PublicHeaderProps) {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const { data: session, status } = useSession();
  const { itemCount } = useCart();
  const { theme, setTheme } = useTheme();
  const otherLocale = locale === "en" ? "ar" : "en";

  const isAuthenticated = status === "authenticated" && !!session?.user;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Logo always links to /shop (unified shop page)
  const logoHref = `/${locale}/shop`;

  return (
    <header className="shrink-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 safe-area-inset-top">
      {/* Row wraps on mobile: brand + actions first, search drops to its own
          full-width second row. On ≥lg everything sits on one line with the
          search taking the free middle space (always visible, header is part
          of the fixed shell so it never scrolls away). */}
      <div className="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 lg:h-16 lg:flex-nowrap lg:py-0">
        {/* Brand — real extracted TSH mark at a readable size */}
        <Link
          href={logoHref}
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
          aria-label={`TSH — ${t("brandCompany")}`}
        >
          <AnimatedLogo className="h-7 sm:h-8" />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-[13px] font-bold">{t("brandStore")}</span>
            <span className="text-[10px] text-muted-foreground">{t("brandCompany")}</span>
          </div>
        </Link>

        {/* Search — order-last drops it to a full second row below lg */}
        <div className="order-last w-full min-w-0 flex-1 lg:order-none lg:mx-2 lg:w-auto lg:max-w-xl">
          <HeaderSearch locale={locale} />
        </div>

        {/* Actions */}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          {/* Theme Toggle - Ultra thin */}
          <button
            onClick={toggleTheme}
            className="native-press relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/50 transition-all hover:border-primary/30 hover:bg-secondary"
            aria-label={theme === "dark" ? t("lightMode") : t("darkMode")}
            title={theme === "dark" ? t("lightMode") : t("darkMode")}
          >
            <Sun className="h-5 w-5 text-foreground/80 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" strokeWidth={1} />
            <Moon className="absolute h-5 w-5 text-foreground/80 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" strokeWidth={1} />
          </button>

          {/* Cart - Gold badge accent */}
          <Link
            href={`/${locale}/cart`}
            className="native-press relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/50 transition-all hover:border-amber-500/30 hover:bg-secondary"
            aria-label={tNav("cart")}
            title={tNav("cart")}
          >
            <ShoppingCart className="h-5 w-5 text-foreground/80" strokeWidth={1} />
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
            href={`/${otherLocale}/shop`}
            className="native-press flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/50 transition-all hover:border-primary/30 hover:bg-secondary"
            aria-label={otherLocale === "ar" ? "التبديل إلى العربية" : "Switch to English"}
            title={otherLocale === "ar" ? "العربية" : "English"}
          >
            <Globe className="h-5 w-5 text-foreground/80" strokeWidth={1} />
          </Link>

          {/* Auth Button - Premium styling */}
          {isAuthenticated ? (
            <>
              <Button asChild variant="luxury" size="default">
                <Link href={`/${locale}/dashboard`} aria-label={tNav("dashboard")}>
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{tNav("dashboard")}</span>
                </Link>
              </Button>
              <AccountChip locale={locale} />
            </>
          ) : (
            <Button asChild variant="gold" size="default">
              <Link href={`/${locale}/login`} aria-label={t("login")}>
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("login")}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
