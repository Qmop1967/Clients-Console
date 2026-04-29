"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface MenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    name?: string;
    email?: string;
  };
  locale: "en" | "ar";
  onLocaleChange: (locale: "en" | "ar") => void;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  key: string;
  href: string;
  icon: typeof Package;
  color?: string;
}

export function MenuDrawer({
  open,
  onOpenChange,
  user,
  locale,
}: MenuDrawerProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const sections: NavSection[] = [
    {
      label: t("sectionMain"),
      items: [
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
  ];

  const isActive = (href: string) => pathname.includes(href);
  const initials = user?.name?.charAt(0) || "U";

  const handleLogout = async () => {
    onOpenChange(false);
    // Clear session recovery data so auto-login doesn't fire after explicit logout
    try { localStorage.removeItem("tsh_session_recovery"); } catch {}
    await signOut({ redirect: false });
    window.location.href = "/" + locale + "/login";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={locale === "ar" ? "right" : "left"}
        className="w-[300px] p-0 flex flex-col h-full"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        hideClose
      >
        {/* === FIXED HEADER === */}
        <SheetHeader className="p-4 pb-3 text-start shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold truncate">
                {user?.name || "Guest"}
              </SheetTitle>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] h-5">
                ⭐ {locale === "ar" ? "عميل جملة" : "Wholesale"}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <Separator className="shrink-0" />

        {/* === SCROLLABLE NAV — with overscroll containment === */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
        >
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="py-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-1">
                {section.label}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/80 hover:bg-muted/50"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : item.color)} strokeWidth={1.5} />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* === FIXED BOTTOM — Utility items + Logout === */}
        <div className="shrink-0 border-t">
          {/* Notifications */}
          <Link
            href="/notifications"
            onClick={() => onOpenChange(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 mx-2 mt-1 rounded-lg text-sm transition-colors",
              isActive("/notifications")
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground/80 hover:bg-muted/50"
            )}
          >
            <Bell className={cn("h-4 w-4 shrink-0", isActive("/notifications") ? "text-primary" : "text-rose-500")} strokeWidth={1.5} />
            <span>{t("notifications")}</span>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            onClick={() => onOpenChange(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors",
              isActive("/settings")
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground/80 hover:bg-muted/50"
            )}
          >
            <Settings className={cn("h-4 w-4 shrink-0", isActive("/settings") ? "text-primary" : "text-slate-500")} strokeWidth={1.5} />
            <span>{t("settings")}</span>
          </Link>

          {/* Support */}
          <Link
            href="/support"
            onClick={() => onOpenChange(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors",
              isActive("/support")
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground/80 hover:bg-muted/50"
            )}
          >
            <HeadphonesIcon className={cn("h-4 w-4 shrink-0", isActive("/support") ? "text-primary" : "text-violet-500")} strokeWidth={1.5} />
            <span>{t("supportTicket")}</span>
          </Link>

          {/* Separator + Logout */}
          <Separator className="mx-2 my-1" />
          <div className="p-3 pt-1" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              {t("logout")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
