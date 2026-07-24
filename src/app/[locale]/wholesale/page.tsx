import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, Headphones, Lightbulb, ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { COMPANY, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }

/**
 * Public wholesale spotlight for a single flagship SKU.
 * Trade-only page: no public price is shown; pricing is quoted per trade account.
 * Deliberately makes NO Dolby (or any unverified brand) claims.
 */
const PRODUCT = {
  brand: "MISDE",
  nameEn: "MISDE Over-Ear Headphones A2 with LED",
  nameAr: "سماعة رأس ميسدي فوق الأذن A2 مع إضاءة LED",
  sku: "TSH-2528",
  // Internal ERP bindings (not shown to visitors) — kept for downstream linking.
  productProductId: 2520,
  productTemplateId: 2528,
  image: "https://media.tsh.sale/media/products/2528/renditions/2282/vision-1024.webp",
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "عرض الجملة — سماعة ميسدي A2 بإضاءة LED" : "Wholesale — MISDE A2 LED Over-Ear Headphones",
    description: isAr
      ? `${PRODUCT.nameAr} — متوفّرة لشركاء ${COMPANY.brand} بالجملة. تصميم فوق الأذن مع إضاءة LED. تواصل معنا للتسعير حسب حسابك التجاري.`
      : `${PRODUCT.nameEn} — available to ${COMPANY.brand} trade partners at wholesale. Over-ear design with LED lighting. Contact us for pricing on your trade account.`,
    alternates: { canonical: `${COMPANY.website}/${locale}/wholesale` },
  };
}

function ProductJsonLd({ locale }: { locale: string }) {
  const isAr = toMarketingLocale(locale) === "ar";
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: isAr ? PRODUCT.nameAr : PRODUCT.nameEn,
    sku: PRODUCT.sku,
    brand: { "@type": "Brand", name: PRODUCT.brand },
    image: PRODUCT.image,
    category: isAr ? "سماعات فوق الأذن" : "Over-ear headphones",
    description: isAr
      ? "سماعة رأس فوق الأذن مع إضاءة LED، متوفّرة بالجملة لتجّار وشركاء يد العنكبوت التقنية في العراق."
      : "Over-ear headphones with LED lighting, offered at wholesale to Tech Spider Hand trade partners in Iraq.",
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export default async function WholesalePage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";

  const features = [
    {
      icon: Headphones,
      en: "Over-ear design", ar: "تصميم فوق الأذن",
      enD: "Cushioned over-ear cups built for long, comfortable listening sessions.",
      arD: "وسائد فوق الأذن مصمّمة لجلسات استماع طويلة ومريحة.",
    },
    {
      icon: Lightbulb,
      en: "LED lighting", ar: "إضاءة LED",
      enD: "Built-in LED accent lighting that stands out on the shelf and in use.",
      arD: "إضاءة LED مدمجة تلفت الأنظار على الرف وأثناء الاستخدام.",
    },
    {
      icon: Boxes,
      en: "Ready stock, wholesale", ar: "مخزون جاهز بالجملة",
      enD: "Held in our Baghdad warehouse and available to trade partners by the carton.",
      arD: "متوفّرة في مخزننا ببغداد وتُورّد لشركائنا التجّار بالكرتون.",
    },
    {
      icon: ShieldCheck,
      en: "Genuine goods", ar: "بضاعة أصلية",
      enD: "Original stock only, with supplier invoices retained for every shipment.",
      arD: "بضاعة أصلية فقط، مع الاحتفاظ بفواتير المورّد لكل شحنة.",
    },
  ];

  return (
    <MarketingShell locale={locale}>
      <ProductJsonLd locale={locale} />

      <div
        className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12"
        data-sku={PRODUCT.sku}
        data-product-product-id={PRODUCT.productProductId}
        data-product-template-id={PRODUCT.productTemplateId}
      >
        {/* Product image — public approved rendition. */}
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
          <Image
            src={PRODUCT.image}
            alt={isAr ? PRODUCT.nameAr : PRODUCT.nameEn}
            width={1024}
            height={1024}
            priority
            sizes="(max-width: 1024px) 100vw, 26rem"
            className="h-auto w-full object-contain"
          />
        </div>

        {/* Product intro + CTAs. */}
        <div>
          <span className="inline-flex items-center rounded-full bg-gold-subtle px-3 py-1 text-xs font-semibold text-gold">
            {isAr ? "عرض الجملة" : "Wholesale offer"}
          </span>

          <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
            {isAr ? PRODUCT.nameAr : PRODUCT.nameEn}
          </h1>

          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            <span dir="ltr">{PRODUCT.brand}</span>
            <span className="mx-2 text-border">•</span>
            {isAr ? "رمز الصنف: " : "SKU: "}
            <span dir="ltr" className="text-foreground">{PRODUCT.sku}</span>
          </p>

          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            {isAr
              ? "سماعة رأس فوق الأذن بإضاءة LED مميّزة وصوت غنيّ ممتلئ، مناسبة للاستماع اليومي والألعاب. متوفّرة لشركائنا من التجّار والمكاتب الفنية بالجملة."
              : "Over-ear headphones with distinctive LED lighting and rich, full-bodied sound — made for everyday listening and gaming. Available to our dealers and technical offices at wholesale."}
          </p>

          <p className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {isAr
              ? "الأسعار تُقدَّم حسب حسابك التجاري لدى الشركة. تواصل معنا للحصول على عرض السعر وكميات التوريد."
              : "Prices are quoted per your trade account. Contact us for a quotation and supply quantities."}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${locale}/contact-us`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gold px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isAr ? "تواصل معنا للتسعير" : "Contact us for pricing"}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
            <Link
              href={`/${locale}/catalog`}
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isAr ? "تصفّح الكتالوج" : "Browse the catalog"}
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-14" aria-labelledby="features">
        <h2 id="features" className="font-display text-2xl font-bold text-foreground">
          {isAr ? "لماذا هذه السماعة" : "Why this headphone"}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.en} className="flex gap-4 rounded-xl border border-border bg-card p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold-subtle text-gold">
                <f.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">{isAr ? f.ar : f.en}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{isAr ? f.arD : f.enD}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 sm:p-8" aria-labelledby="cta">
        <h2 id="cta" className="font-display text-xl font-bold text-foreground">
          {isAr ? "جاهز للتوريد" : "Ready to supply"}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {isAr
            ? "نورّد بالجملة للتجّار والمكاتب الفنية في عموم العراق. تواصل معنا لعرض السعر، أو تصفّح باقي أقسامنا في الكتالوج."
            : "We supply dealers and technical offices across Iraq at wholesale. Contact us for a quotation, or explore the rest of our departments in the catalog."}
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${locale}/contact-us`}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gold px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {isAr ? "تواصل معنا" : "Contact us"}
          </Link>
          <Link
            href={`/${locale}/catalog`}
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {isAr ? "الكتالوج" : "Catalog"}
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
