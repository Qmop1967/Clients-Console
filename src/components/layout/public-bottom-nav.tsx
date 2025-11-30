"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useCart } from "@/components/providers/cart-provider";
import {
  ShoppingBag,
  ShoppingCart,
  User,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";

interface PublicBottomNavProps {
  onMenuClick?: () => void;
}

export function PublicBottomNav({ onMenuClick }: PublicBottomNavProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { itemCount } = useCart();

  const isAuthenticated = status === "authenticated" && !!session?.user;

  // Dynamic nav items based on auth state
  const navItems = [
    {
      key: "shop",
      href: isAuthenticated ? "/products" : "/shop",
      icon: ShoppingBag,
      label: tCommon("shop"),
    },
    {
      key: "cart",
      href: "/cart",
      icon: ShoppingCart,
      label: t("cart"),
      badge: itemCount > 0 ? itemCount : undefined,
    },
    ...(isAuthenticated
      ? [
          {
            key: "dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            label: t("dashboard"),
          },
        ]
      : [
          {
            key: "login",
            href: "/login",
            icon: User,
            label: tCommon("login"),
          },
        ]),
    {
      key: "menu",
      href: "#menu",
      icon: Menu,
      label: t("menu"),
    },
  ];

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
                <span className="text-xs">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn("h-5 w-5", isActive && "fill-primary/20")}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full px-1 text-[10px]"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
