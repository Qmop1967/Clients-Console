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
import {
  FileText,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  HeadphonesIcon,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Globe,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

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
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const toggleLocale = () => {
    onLocaleChange(locale === "en" ? "ar" : "en");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={locale === "ar" ? "left" : "right"} className="w-80">
        <SheetHeader className="text-start">
          <div className="flex items-center gap-3 py-2">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <SheetTitle className="text-base font-medium">
                {user?.name || "Guest"}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {user?.company || user?.email}
              </p>
            </div>
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100vh-220px)]">
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-5 w-5" />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator className="my-4" />

        <div className="flex flex-col gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            className="justify-start gap-3"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>

          {/* Language Toggle */}
          <Button
            variant="ghost"
            className="justify-start gap-3"
            onClick={toggleLocale}
          >
            <Globe className="h-5 w-5" />
            {locale === "en" ? "العربية" : "English"}
          </Button>

          {/* Sign Out */}
          <Button
            variant="ghost"
            className="justify-start gap-3 text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            {t("logout") || "Sign Out"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
