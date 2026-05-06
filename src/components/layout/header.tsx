"use client";

import { ShoppingCart, LogOut, User } from "lucide-react";
import { NotificationDropdown } from "./notification-dropdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { useCatalogMode } from "@/components/providers/catalog-mode-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface HeaderProps {
  title?: string;
  cartCount?: number;
  onCartClick?: () => void;
  user?: { name?: string; email?: string };
  locale?: "en" | "ar";
}

export function Header({ title, cartCount = 0, onCartClick, user, locale = "ar" }: HeaderProps) {
  const { isCatalogMode, showCatalogModal } = useCatalogMode();
  const t = useTranslations("nav");

  const initials = user?.name?.charAt(0) || "U";

  const handleLogout = async () => {
    try { localStorage.removeItem("tsh_session_recovery"); } catch {}
    await signOut({ redirect: false });
    window.location.href = "/" + locale + "/login";
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Logo / Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <AnimatedLogo />
            <div className="flex flex-col">
              <h1 className="font-display text-lg font-semibold tracking-tight">
                {title || "TSH"}
              </h1>
            </div>
          </div>
        </div>

        {/* Desktop: Breadcrumb-like current page indicator */}
        {/* This space intentionally left for future search / command palette */}

        {/* Actions */}
        <div className="flex items-center gap-1 lg:gap-2">
          {/* Notifications */}
          <NotificationDropdown />

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full transition-all hover:bg-secondary"
            onClick={isCatalogMode ? showCatalogModal : onCartClick}
            aria-label="Shopping cart"
          >
            <ShoppingCart className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
            {!isCatalogMode && cartCount > 0 && (
              <Badge
                variant="gold"
                className="absolute -end-0.5 -top-0.5 h-5 min-w-5 rounded-full p-0 text-[10px] flex items-center justify-center border-2 border-background animate-scale-in"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </Badge>
            )}
          </Button>

          {/* Desktop user menu — hidden on mobile (mobile uses drawer) */}
          {user && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="hidden lg:flex items-center gap-2 h-10 px-2 rounded-full hover:bg-secondary"
                >
                  <Avatar className="h-7 w-7 border border-border/50">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground/80 max-w-[140px] truncate">
                    {user.name}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <div className="px-2 py-1.5 mb-1">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <Separator className="my-1" />
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground/80 hover:bg-muted transition-colors"
                >
                  <User className="h-4 w-4" />
                  {t("profile") || "الملف الشخصي"}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t("logout")}
                </button>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}
