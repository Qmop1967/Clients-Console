"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  HeadphonesIcon,
  User,
  LogOut,
  Moon,
  Sun,
  Globe,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { useCart } from "@/components/providers/cart-provider";

interface MenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    name?: string;
    email?: string;
    company?: string;
  };
  locale: "en" | "ar";
  onLocaleChange: (locale: "en" | "ar") => void;
}

const menuItems = [
  {
    key: "invoices",
    href: "/invoices",
    icon: FileText,
  },
  {
    key: "payments",
    href: "/payments",
    icon: CreditCard,
  },
  {
    key: "creditNotes",
    href: "/credit-notes",
    icon: Receipt,
  },
  {
    key: "accountStatement",
    href: "/account-statement",
    icon: FileSpreadsheet,
  },
  {
    key: "supportTicket",
    href: "/support",
    icon: HeadphonesIcon,
  },
  {
    key: "profile",
    href: "/profile",
    icon: User,
  },
];

export function MenuDrawer({
  open,
  onOpenChange,
  user,
  locale,
  onLocaleChange,
}: MenuDrawerProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const { clearCart } = useCart();

  const handleSignOut = async () => {
    // Clear cart before signing out to remove user-specific items
    clearCart();
    await signOut({ callbackUrl: "/login" });
  };

  const toggleLocale = () => {
    onLocaleChange(locale === "en" ? "ar" : "en");
  };

  const userInitial = user?.name?.charAt(0) || user?.email?.charAt(0) || "U";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="w-80 border-border/50"
      >
        <SheetHeader className="text-start">
          {/* Premium User Profile Section */}
          <div className="flex items-center gap-3 py-3">
            <Avatar className="h-14 w-14 ring-2 ring-amber-500/20 ring-offset-2 ring-offset-background">
              <AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-600 text-white font-display text-lg">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <SheetTitle className="font-display text-lg font-semibold truncate">
                {user?.name || "Guest"}
              </SheetTitle>
              <p className="text-sm text-muted-foreground truncate">
                {user?.company || user?.email}
              </p>
              <Badge variant="gold-subtle" className="mt-1 w-fit text-[10px]">
                {tCommon("wholesaleClient") || "Wholesale Client"}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <ScrollArea className="flex-1 max-h-[calc(100vh-400px)]">
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-amber-500/10">
                      <Icon className="h-5 w-5 transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-500" strokeWidth={1.5} />
                    </div>
                    <span>{t(item.key)}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-50 rtl:rotate-180" />
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator className="my-4" />

        {/* Settings Section */}
        <div className="flex flex-col gap-1 pb-4">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            className="h-auto justify-start gap-3 px-3 py-3 font-normal hover:bg-secondary"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
              ) : (
                <Moon className="h-5 w-5" strokeWidth={1.5} />
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {theme === "dark"
                ? (tCommon("lightMode") || "Light Mode")
                : (tCommon("darkMode") || "Dark Mode")}
            </span>
          </Button>

          {/* Language Toggle */}
          <Button
            variant="ghost"
            className="h-auto justify-start gap-3 px-3 py-3 font-normal hover:bg-secondary"
            onClick={toggleLocale}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Globe className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <span className="text-sm text-muted-foreground">
              {locale === "en" ? "العربية" : "English"}
            </span>
          </Button>

          {/* Sign Out */}
          <Button
            variant="ghost"
            className="h-auto justify-start gap-3 px-3 py-3 font-normal text-destructive hover:bg-red-50 hover:text-destructive dark:hover:bg-red-900/10"
            onClick={handleSignOut}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20">
              <LogOut className="h-5 w-5 text-destructive" strokeWidth={1.5} />
            </div>
            <span className="text-sm">{t("logout") || "Sign Out"}</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
