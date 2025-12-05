"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  {
    key: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "shop",
    href: "/shop",
    icon: Package,
  },
  {
    key: "orders",
    href: "/orders",
    icon: ShoppingBag,
  },
  {
    key: "menu",
    href: "#menu",
    icon: Menu,
  },
];

interface BottomNavProps {
  onMenuClick?: () => void;
}

export function BottomNav({ onMenuClick }: BottomNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
      <div className="flex h-16 items-center justify-around px-4">
        {navItems.map((item) => {
          const isActive =
            item.key !== "menu" && pathname.includes(item.href);
          const Icon = item.icon;

          if (item.key === "menu") {
            return (
              <button
                key={item.key}
                onClick={onMenuClick}
                className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{t(item.key)}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-5 w-5", isActive && "fill-primary/20")}
              />
              <span className="text-xs font-medium">{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
