import { type Locale, localeDirection } from "@/i18n/config";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicLayoutClient } from "@/components/layout/public-layout-client";
import { WhatsAppFloat } from "@/components/ui/whatsapp-float";
import { COMPANY_PHONE_DISPLAY, whatsappSalesLink } from "@/lib/config/contact";

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
  const tNav = await getTranslations("nav");
  const dir = localeDirection[locale as Locale] || "ltr";

  const footer = (
    <footer className="hidden md:block border-t bg-muted/50 py-10 mt-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/tsh-mark.webp"
              alt="TSH"
              className="h-9 w-auto"
              loading="lazy"
              decoding="async"
            />
            <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              {tFooter("aboutShort")}
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-2 text-sm">
            <p className="font-bold text-foreground">{tFooter("quickLinks")}</p>
            <div className="flex flex-col gap-1.5 text-muted-foreground">
              <Link href={`/${locale}/shop`} className="w-fit hover:text-foreground hover:underline">
                {tCommon("shop")}
              </Link>
              <Link href={`/${locale}/dashboard`} className="w-fit hover:text-foreground hover:underline">
                {tNav("dashboard")}
              </Link>
              <Link href={`/${locale}/orders`} className="w-fit hover:text-foreground hover:underline">
                {tNav("orders")}
              </Link>
              <Link href={`/${locale}/account-statement`} className="w-fit hover:text-foreground hover:underline">
                {tNav("accountStatement")}
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2 text-sm">
            <p className="font-bold text-foreground">{tFooter("contactUs")}</p>
            <div className="flex flex-col gap-1.5 text-muted-foreground">
              <span dir="ltr" className="w-fit font-medium tabular-nums">{COMPANY_PHONE_DISPLAY}</span>
              <a
                href={whatsappSalesLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit hover:text-foreground hover:underline"
              >
                {tCommon("whatsappSales")}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {tFooter("legalName")} — {tFooter("allRightsReserved")}
        </div>
      </div>
    </footer>
  );

  return (
    // Fixed app-shell: only <main> scrolls; header + bottom nav are shrink-0 flex
    // children (no position:fixed) so they never detach during iOS momentum scroll.
    <div dir={dir} className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* Public Header with Cart */}
      <PublicHeader locale={locale} />

      {/* Main Content with Bottom Nav */}
      <PublicLayoutClient locale={locale} footer={footer}>
        {children}
      </PublicLayoutClient>

      {/* Always-reachable sales WhatsApp */}
      <WhatsAppFloat />
    </div>
  );
}
