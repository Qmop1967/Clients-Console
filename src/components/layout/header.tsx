"use client";

import { ShoppingCart, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedLogo } from "@/components/ui/animated-logo";

interface HeaderProps {
  title?: string;
  cartCount?: number;
  onCartClick?: () => void;
}

export function Header({ title, cartCount = 0, onCartClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
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

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full transition-all hover:bg-secondary"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
          </Button>

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full transition-all hover:bg-secondary"
            onClick={onCartClick}
            aria-label="Shopping cart"
          >
            <ShoppingCart className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
            {cartCount > 0 && (
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
