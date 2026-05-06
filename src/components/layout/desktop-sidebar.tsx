"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Search,
  FileText,
  CreditCard,
  FileSpreadsheet,
  Receipt,
  Truck,
  CheckCircle,
  RotateCcw,
  Bell,
  Settings,
  HeadphonesIcon,
} from "lucide-react";

interface NavItem {
  key: string;
  href: string;
  icon: typeof Package;
  badge?: number;
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    labelKey: "sectionMain",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "shop", href: "/shop", icon: Package },
      { key: "orders", href: "/orders", icon: ShoppingBag },
      { key: "stockCheck", href: "/stock", icon: Search },
    ],
  },
  {
    labelKey: "sectionFinance",
    items: [
      { key: "invoices", href: "/invoices", icon: FileText },
      { key: "payments", href: "/payments", icon: CreditCard },
      { key: "accountStatement", href: "/account-statement", icon: FileSpreadsheet },
      { key: "creditNotes", href: "/credit-notes", icon: Receipt },
    ],
  },
  {
    labelKey: "sectionShipping",
    items: [
      { key: "deliveries", href: "/deliveries", icon: Truck },
      { key: "deliveryConfirm", href: "/delivery-confirm", icon: CheckCircle },
      { key: "returns", href: "/returns", icon: RotateCcw },
    ],
  },
  {
    labelKey: "sectionAccount",
    items: [
      { key: "notifications", href: "/notifications", icon: Bell },
      { key: "settings", href: "/settings", icon: Settings },
      { key: "supportTicket", href: "/support", icon: HeadphonesIcon },
    ],
  },
];

export function DesktopSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Exact match for dashboard, contains for others
    if (href === "/dashboard") {
      return pathname.endsWith("/dashboard");
    }
    return pathname.includes(href);
  };

  return (
    <aside className="hidden lg:flex flex-col w-[var(--sidebar-width)] border-e border-border/40 bg-card/50 backdrop-blur-sm sticky top-14 h-[calc(100vh-3.5rem)]">
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-6 px-3">
          {sections.map((section) => (
            <div key={section.labelKey}>
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-3 mb-2">
                {t(section.labelKey)}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                        active
                          ? "bg-primary/10 text-primary font-medium shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active ? "text-primary" : "text-muted-foreground/70"
                        )}
                        strokeWidth={active ? 2 : 1.5}
                      />
                      <span className="truncate">{t(item.key)}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
