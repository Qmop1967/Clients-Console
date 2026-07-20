import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { COMPANY, toMarketingLocale } from "@/lib/marketing/company";

/**
 * Renders the address literally. Cloudflare Email Address Obfuscation replaces plain
 * mailto text with "[email protected]" unless wrapped in its email_off markers, which
 * would hide our contact address from any reviewer or crawler that does not run JS.
 */
export function PlainEmail({ className }: { className?: string }) {
  return (
    <span
      className={className}
      dir="ltr"
      dangerouslySetInnerHTML={{ __html: `<!--email_off-->${COMPANY.email}<!--email_on-->` }}
    />
  );
}

/** Machine-readable business identity for search engines and platform policy reviewers. */
export function OrganizationJsonLd({ locale }: { locale: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: COMPANY.legalNameEn,
    alternateName: [COMPANY.legalNameAr, COMPANY.brand],
    legalName: COMPANY.legalNameEn,
    description:
      "Registered wholesale distributor of computer hardware and components, CCTV and security systems, networking products, power supplies, and printers with consumables, serving dealers and trade partners across Iraq.",
    url: COMPANY.website,
    logo: `${COMPANY.website}/images/tsh-lockup.webp`,
    email: COMPANY.email,
    telephone: COMPANY.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY.streetEn,
      addressLocality: "Baghdad",
      addressCountry: "IQ",
    },
    contactPoint: [{
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: COMPANY.phone,
      email: COMPANY.email,
      areaServed: "IQ",
      availableLanguage: ["ar", "en"],
    }],
    inLanguage: locale,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Public shop-window chrome. No session, no client JS, no data fetching. */

const NAV = [
  { href: "", ar: "الرئيسية", en: "Home" },
  { href: "/about", ar: "من نحن", en: "About" },
  { href: "/catalog", ar: "المنتجات", en: "Products" },
  { href: "/contact-us", ar: "تواصل معنا", en: "Contact" },
] as const;

export function MarketingHeader({ locale }: { locale: string }) {
  const isAr = toMarketingLocale(locale) === "ar";
  const name = isAr ? COMPANY.legalNameAr : COMPANY.legalNameEn;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="relative mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <Link href={`/${locale}`} className="shrink-0 py-1" aria-label={name}>
          <Image src="/images/tsh-lockup.webp" alt={name} width={132} height={44} priority className="h-10 w-auto" />
        </Link>

        {/* Desktop nav — natural width, hugs the logo. No flex-1: it used to stretch
            to 894px and open a dead gap in the middle of the header. */}
        <nav className="hidden items-center gap-x-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isAr ? item.ar : item.en}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <Link
            href={`/${locale === "ar" ? "en" : "ar"}`}
            hrefLang={locale === "ar" ? "en" : "ar"}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {locale === "ar" ? "EN" : "ع"}
          </Link>

          <Link
            href={`/${locale}/login`}
            className="inline-flex min-h-11 items-center rounded-lg bg-gold px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {isAr ? "دخول الشركاء" : "Partner login"}
          </Link>

          {/* Mobile menu — <details> keeps every public page server-rendered (no client JS). */}
          <details className="group md:hidden">
            <summary
              className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-foreground [&::-webkit-details-marker]:hidden"
              aria-label={isAr ? "القائمة" : "Menu"}
            >
              <Menu className="size-5 group-open:hidden" aria-hidden />
              <X className="hidden size-5 group-open:block" aria-hidden />
            </summary>
            <nav className="absolute inset-x-0 top-full hidden border-b border-border bg-background px-4 pb-3 shadow-lg group-open:block">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={`/${locale}${item.href}`}
                  className="flex min-h-12 items-center border-b border-border/50 text-[15px] text-foreground last:border-0"
                >
                  {isAr ? item.ar : item.en}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ locale }: { locale: string }) {
  const isAr = toMarketingLocale(locale) === "ar";
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {isAr ? COMPANY.legalNameAr : COMPANY.legalNameEn}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "موزّع جملة لمنتجات الحاسبات وأنظمة المراقبة والشبكات ومصادر الطاقة في العراق."
              : "Wholesale distributor of computer hardware, CCTV, networking and power products in Iraq."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
            {isAr ? "مسجّلة بموجب " : "Registered under "}
            {isAr ? COMPANY.incorporationAr : COMPANY.incorporation}
          </p>
        </div>

        <address className="space-y-3 text-sm not-italic text-muted-foreground">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
            <span>
              {isAr ? COMPANY.streetAr : COMPANY.streetEn}
              <br />
              {isAr ? COMPANY.cityAr : COMPANY.cityEn}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-gold" aria-hidden />
            <a href={`tel:${COMPANY.phone}`} className="inline-flex min-h-11 items-center hover:text-foreground" dir="ltr">
              {COMPANY.phoneDisplay}
            </a>
          </p>
          <p className="flex items-center gap-2">
            <Mail className="size-4 shrink-0 text-gold" aria-hidden />
            <a href={`mailto:${COMPANY.email}`} className="inline-flex min-h-11 items-center hover:text-foreground">
              <PlainEmail />
            </a>
          </p>
          <p className="text-xs">{isAr ? COMPANY.hoursAr : COMPANY.hoursEn}</p>
        </address>

        <nav className="space-y-2 text-sm">
          <h2 className="font-semibold text-foreground">{isAr ? "روابط" : "Links"}</h2>
          {[
            { href: "/about", ar: "من نحن", en: "About us" },
            { href: "/catalog", ar: "المنتجات", en: "Products" },
            { href: "/contact-us", ar: "تواصل معنا", en: "Contact us" },
            { href: "/privacy", ar: "سياسة الخصوصية", en: "Privacy policy" },
            { href: "/terms", ar: "الشروط والأحكام", en: "Terms of service" },
          ].map((l) => (
            <Link key={l.href} href={`/${locale}${l.href}`} className="flex min-h-11 items-center text-muted-foreground hover:text-foreground">
              {isAr ? l.ar : l.en}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground">
        <span dir="ltr">
          &copy; {year} {COMPANY.legalNameEn} &middot; {COMPANY.cityEn}
        </span>
      </div>
    </footer>
  );
}

/** Wraps a public page with header + footer and a consistent content rhythm. */
export function MarketingShell({ locale, children }: { locale: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <OrganizationJsonLd locale={locale} />
      <MarketingHeader locale={locale} />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-12">{children}</main>
      <MarketingFooter locale={locale} />
    </div>
  );
}
