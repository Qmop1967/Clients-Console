"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShoppingCart, Search } from "lucide-react";
import { NotificationDropdown } from "./notification-dropdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { useCatalogMode } from "@/components/providers/catalog-mode-provider";

interface HeaderProps {
  title?: string;
  cartCount?: number;
  onCartClick?: () => void;
  onMenuClick?: () => void;
}

export function Header({ title, cartCount = 0, onCartClick }: HeaderProps) {
  const { isCatalogMode, showCatalogModal } = useCatalogMode();
  const t = useTranslations("nav");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // Route to shop search; lightweight integration for now
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
        {/* === Left/Start: Logo (mobile only) === */}
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex items-center gap-2.5">
            <AnimatedLogo />
            <div className="flex flex-col">
              <h1 className="font-display text-lg font-semibold tracking-tight">
                {title || "TSH"}
              </h1>
            </div>
          </div>
        </div>

        {/* === Page Title (desktop only) === */}
        {title && (
          <div className="hidden lg:flex items-center">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {title}
            </h1>
          </div>
        )}

        {/* === Center: Search Bar (desktop only) === */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden lg:flex flex-1 max-w-xl mx-auto"
        >
          <div className="relative w-full">
            <Search
              className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full h-10 ps-10 pe-4 rounded-lg border border-input bg-background/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors"
              aria-label={t("searchPlaceholder")}
            />
          </div>
        </form>

        {/* === Right/End: Actions === */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <NotificationDropdown />

          {/* Cart - shows modal in catalog mode, otherwise navigates to cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full transition-all hover:bg-secondary"
            onClick={isCatalogMode ? showCatalogModal : onCartClick}
            aria-label="Shopping cart"
          >
            <ShoppingCart className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
            {/* Hide cart count badge in catalog mode */}
            {!isCatalogMode && cartCount > 0 && (
              <Badge
                variant="gold"
                className="absolute -end-0.5 -top-0.5 h-5 min-w-5 rounded-full p-0 text-[10px] flex items-center justify-center border-2 border-background animate-scale-in"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
