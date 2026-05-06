"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import {
  FileText,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  HeadphonesIcon,
  LogOut,
  ShoppingBag,
  Package,
  Search,
  Truck,
  CheckCircle,
  RotateCcw,
  Bell,
  Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  user?: {
    name?: string;
    email?: string;
  };
  locale: "en" | "ar";
  className?: string;
}

interface NavItem {
  key: string;
  href: string;
  icon: typeof Package;
  color?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export function Sidebar({ user, locale, className }: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const sections: NavSection[] = [
    {
      label: t("sectionMain"),
      items: [
        { key: "dashboard", href: "/dashboard", icon: Package, color: "text-sky-500" },
        { key: "orders", href: "/orders", icon: ShoppingBag, color: "text-blue-500" },
        { key: "shop", href: "/shop", icon: Package, color: "text-emerald-500" },
        { key: "stockCheck", href: "/stock", icon: Search, color: "text-cyan-500" },
      ],
    },
    {
      label: t("sectionFinance"),
      items: [
        { key: "invoices", href: "/invoices", icon: FileText, color: "text-purple-500" },
        { key: "payments", href: "/payments", icon: CreditCard, color: "text-green-500" },
        { key: "accountStatement", href: "/account-statement", icon: FileSpreadsheet, color: "text-indigo-500" },
        { key: "creditNotes", href: "/credit-notes", icon: Receipt, color: "text-amber-500" },
      ],
    },
    {
      label: t("sectionShipping"),
      items: [
        { key: "deliveries", href: "/deliveries", icon: Truck, color: "text-orange-500" },
        { key: "deliveryConfirm", href: "/delivery-confirm", icon: CheckCircle, color: "text-teal-500" },
        { key: "returns", href: "/returns", icon: RotateCcw, color: "text-red-500" },
      ],
    },
    {
      label: t("sectionExtras"),
      items: [
        { key: "notifications", href: "/notifications", icon: Bell, color: "text-rose-500" },
        { key: "settings", href: "/settings", icon: Settings, color: "text-slate-500" },
        { key: "supportTicket", href: "/support", icon: HeadphonesIcon, color: "text-violet-500" },
      ],
    },
  ];

  const isActive = (href: string) => pathname.includes(href);
  const initials = user?.name?.charAt(0)?.toUpperCase() || "U";

  const handleLogout = async () => {
    try {
      localStorage.removeItem("tsh_session_recovery");
    } catch {}
    await signOut({ redirect: false });
    window.location.href = "/" + locale + "/login";
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 start-0 z-30 w-64 border-e bg-card/50 backdrop-blur-sm flex-col",
        className
      )}
      aria-label="Main navigation"
    >
      {/* === Top Section: Logo === */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4 shrink-0">
        <AnimatedLogo />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base font-semibold tracking-tight">
            TSH
          </span>
          <span className="text-[10px] text-muted-foreground">
            {locale === "ar" ? "بوابة العملاء" : "Clients Portal"}
          </span>
        </div>
      </div>

      {/* === User Section === */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" title={user?.name}>
              {user?.name || (locale === "ar" ? "ضيف" : "Guest")}
            </p>
            <p className="text-[11px] text-muted-foreground truncate" title={user?.email}>
              {user?.email}
            </p>
            <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">
              ⭐ {t("wholesaleBadge")}
            </Badge>
          </div>
        </div>
      </div>

      <Separator className="shrink-0" />

      {/* === Scrollable Navigation === */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto py-2"
        style={{ overscrollBehavior: "contain" }}
      >
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="py-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-1 mt-2">
              {section.label}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-2 mx-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground/80 hover:bg-muted/60"
                  )}
                >
                  {active && (
                    <span
                      className="absolute inset-y-1 start-0 w-0.5 bg-primary rounded-full"
                      aria-hidden
                    />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : item.color
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="truncate">{t(item.key)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* === Bottom Section: Logout === */}
      <div className="shrink-0 border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          {t("logout")}
        </Button>
      </div>
    </aside>
  );
}
