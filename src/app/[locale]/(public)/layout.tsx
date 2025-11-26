import { type Locale, localeDirection } from "@/i18n/config";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";

interface PublicLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function PublicLayout({
  children,
  params,
}: PublicLayoutProps) {
  const { locale } = await params;
  const tFooter = await getTranslations("footer");
  const tCommon = await getTranslations("common");
  const dir = localeDirection[locale as Locale] || "ltr";

  return (
    <div dir={dir} className="min-h-screen bg-background">
      {/* Public Header with Cart */}
      <PublicHeader locale={locale} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TSH. {tFooter("allRightsReserved")}</p>
          <p className="mt-2">
            <Link href={`/${locale}/login`} className="hover:underline">
              {tCommon("login")}
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
