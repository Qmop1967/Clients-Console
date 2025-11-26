import { type Locale, localeDirection } from "@/i18n/config";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ShoppingBag, User, Sun, Moon, Globe } from "lucide-react";

interface PublicLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function PublicLayout({
  children,
  params,
}: PublicLayoutProps) {
  const { locale } = await params;
  const t = await getTranslations("common");
  const tFooter = await getTranslations("footer");
  const dir = localeDirection[locale as Locale] || "ltr";
  const otherLocale = locale === "en" ? "ar" : "en";

  return (
    <div dir={dir} className="min-h-screen bg-background">
      {/* Public Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <Link href={`/${locale}/shop`} className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">TSH</span>
            <span className="text-sm text-muted-foreground">Shop</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <Link
              href={`/${otherLocale}/shop`}
              className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
            >
              <Globe className="h-4 w-4" />
            </Link>

            {/* Login Button */}
            <Link
              href={`/${locale}/login`}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <User className="h-4 w-4" />
              <span>{t("login")}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TSH. {tFooter("allRightsReserved")}</p>
          <p className="mt-2">
            <Link href={`/${locale}/login`} className="hover:underline">
              {t("login")}
            </Link>
            {" | "}
            <Link href="#" className="hover:underline">
              {tFooter("contactUs")}
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
