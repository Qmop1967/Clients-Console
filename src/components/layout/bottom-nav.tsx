"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Store,
  Package,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "shop", href: "/shop", icon: Store },
  { key: "orders", href: "/orders", icon: Package },
  { key: "menu", href: "#menu", icon: Menu },
];

interface BottomNavProps {
  onMenuClick?: () => void;
}

export function BottomNav({ onMenuClick }: BottomNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/30 bg-background/98 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90 safe-area-bottom lg:hidden">
      <div className="flex h-16 items-center justify-around px-2 rtl:flex-row-reverse">
        {navItems.map((item) => {
          const isActive =
            item.key !== "menu" && pathname.includes(item.href);
          const Icon = item.icon;

          if (item.key === "menu") {
            return (
              <button
                key={item.key}
                onClick={onMenuClick}
                className="native-press flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="h-6 w-6" strokeWidth={1.5} />
                <span className="text-xs font-medium">{t(item.key)}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "native-press relative flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 transition-all",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-6 w-6", isActive && "fill-primary/20")}
                strokeWidth={1.5}
              />
              <span className="text-xs font-medium">{t(item.key)}</span>
              {isActive && (
                <div className="absolute -bottom-1 h-1 w-6 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
