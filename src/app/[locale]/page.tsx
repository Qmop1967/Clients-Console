import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Lock, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { CATEGORIES, COMPANY, TOTAL_SKUS, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr
      ? `${COMPANY.legalNameAr} — توزيع الجملة لمنتجات الحاسبات والمراقبة والشبكات`
      : `${COMPANY.legalNameEn} — Wholesale Computer, CCTV & Networking Distributor in Iraq`,
    description: isAr
      ? "موزّع جملة مسجّل في بغداد، العراق. حاسبات ومكوّنات، كاميرات مراقبة، شبكات، مصادر طاقة، طابعات ومستلزماتها لشبكة الوكلاء وتجار الجملة في عموم العراق."
      : "Registered wholesale distributor in Baghdad, Iraq. Computer hardware, CCTV and security systems, networking, power supplies, printers and consumables for dealers and trade partners across Iraq.",
    alternates: { canonical: `${COMPANY.website}/${locale}` },
    openGraph: {
      type: "website",
      siteName: COMPANY.legalNameEn,
      url: `${COMPANY.website}/${locale}`,
      title: isAr ? COMPANY.legalNameAr : COMPANY.legalNameEn,
      description: isAr
        ? "موزّع جملة لمنتجات تقنية المعلومات وأنظمة المراقبة في بغداد، العراق."
        : "Wholesale IT hardware and security systems distributor in Baghdad, Iraq.",
      images: [
        {
          url: `${COMPANY.website}/images/tsh-lockup.webp`,
          width: 560,
          height: 394,
          alt: isAr ? COMPANY.legalNameAr : COMPANY.legalNameEn,
        },
      ],
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  // Verified figures: SKUs + departments from product_template; customers from
  // res_partner (customer_rank > 0), rounded down. No estimates.
  const FACTS = [
    { ar: "أصناف فعّالة", en: "Active SKUs", valueAr: TOTAL_SKUS.toLocaleString("en-US"), valueEn: TOTAL_SKUS.toLocaleString("en-US"), ltr: true },
    { ar: "أقسام رئيسية", en: "Departments", valueAr: "8", valueEn: "8", ltr: true },
    { ar: "عملاء تجاريون", en: "Trade customers", valueAr: "+2,000", valueEn: "2,000+", ltr: true },
    { ar: "المقرّ", en: "Head office", valueAr: "بغداد", valueEn: "Baghdad", ltr: false },
  ];

  const pillars = [
    { icon: Building2,
      ar: { t: "شركة مسجّلة", d: "مسجّلة رسمياً في بغداد بموجب قانون الشركات العراقي رقم 21 لسنة 1997، بمقرّ ومكتب ثابت." },
      en: { t: "A registered company", d: "Formally registered in Baghdad under Iraqi Companies Law No. 21 of 1997, with a fixed office and warehouse." } },
    { icon: PackageSearch,
      ar: { t: "مخزون عميق", d: `أكثر من ${TOTAL_SKUS.toLocaleString("en-US")} صنف فعّال عبر ثمانية أقسام، مُدارة على نظام ERP واحد.` },
      en: { t: "Deep inventory", d: `Over ${TOTAL_SKUS.toLocaleString("en-US")} active SKUs across eight departments, managed on a single ERP.` } },
    { icon: Truck,
      ar: { t: "توزيع في عموم العراق", d: "شبكة مندوبين ومناديب توصيل تخدم المحافظات، مع متابعة الطلب حتى التسليم." },
      en: { t: "Nationwide distribution", d: "A field sales and delivery network serving Iraqi provinces, with order tracking through to delivery." } },
    { icon: ShieldCheck,
      ar: { t: "بضاعة أصلية", d: "نستورد ونوزّع بضاعة أصلية بفواتير مورّدين موثّقة وضمان معتمد." },
      en: { t: "Genuine goods", d: "We import and distribute genuine stock with documented supplier invoices and honoured warranty." } },
  ];

  return (
    <MarketingShell locale={locale}>
      {/* Hero — two columns. In RTL a max-w text block strands ~384px of dead space on
          the left; the facts panel occupies it with real figures instead of padding. */}
      <section className="border-b border-border/60 pb-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,21rem)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold" dir="ltr">
              Baghdad, Iraq &middot; Wholesale distribution
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
              {isAr ? COMPANY.legalNameAr : COMPANY.legalNameEn}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              {isAr
                ? "نحن موزّع جملة لمنتجات الحاسبات ومكوّناتها، وكاميرات المراقبة وأنظمة الأمان، ومنتجات الشبكات، ومصادر الطاقة، والطابعات ومستلزماتها. نخدم الوكلاء وتجار الجملة والمكاتب الفنية في عموم العراق من مقرّنا في بغداد."
                : "We are a wholesale distributor of computer hardware and components, CCTV and security systems, networking products, power supplies, and printers with their consumables. We supply dealers, wholesalers and technical offices across Iraq from our base in Baghdad."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/catalog`}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {isAr ? "استعرض أقسام المنتجات" : "Browse product departments"}
                <Arrow className="size-4" aria-hidden />
              </Link>
              <Link
                href={`/${locale}/contact-us`}
                className="inline-flex min-h-12 items-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {isAr ? "تواصل معنا" : "Contact us"}
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-1">
            {FACTS.map((f) => (
              <div key={f.en} className="bg-card px-5 py-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{isAr ? f.ar : f.en}</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-foreground" dir={f.ltr ? "ltr" : undefined}>
                  {isAr ? f.valueAr : f.valueEn}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Signature: the real catalog, by department, with real counts */}
      <section className="py-14" aria-labelledby="departments">
        <h2 id="departments" className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {isAr ? "ماذا نوزّع" : "What we distribute"}
        </h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {isAr
            ? "ثمانية أقسام رئيسية. الأعداد أدناه هي أصناف فعّالة في مخزوننا."
            : "Eight departments. The figures below are active SKUs in our live inventory."}
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-sm text-muted-foreground">
          <Lock className="size-3.5 text-gold" aria-hidden />
          {isAr ? "الأسعار متاحة للشركاء المسجّلين بعد تسجيل الدخول." : "Pricing is available to registered partners after login."}
        </p>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c.key} className="bg-card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold text-foreground">{isAr ? c.ar : c.en}</h3>
                <span className="shrink-0 text-sm font-semibold text-gold" dir="ltr">
                  {c.count.toLocaleString("en-US")}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{isAr ? c.arDesc : c.enDesc}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Who we are, in four claims we can evidence */}
      <section className="border-t border-border/60 py-14" aria-labelledby="pillars">
        <h2 id="pillars" className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {isAr ? "كيف نعمل" : "How we operate"}
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, ar, en }) => {
            const copy = isAr ? ar : en;
            return (
              <div key={copy.t} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{copy.t}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{copy.d}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Partner portal explainer — tells a reviewer why the rest of the site is gated */}
      <section className="rounded-xl border border-border bg-muted/40 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-foreground">
          {isAr ? "بوابة الشركاء" : "The partner portal"}
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          {isAr
            ? "الطلبات والأسعار وكشوف الحساب متاحة لوكلائنا وتجّار الجملة المعتمدين عبر تسجيل الدخول، لأنها تخصّ حسابات تجارية وأسعاراً تعاقدية. أمّا معلومات الشركة وأقسام المنتجات ووسائل التواصل فمتاحة للجميع في هذه الصفحات."
            : "Ordering, pricing and account statements sit behind login because they belong to individual trade accounts with contracted prices. Company information, product departments and contact details are open to everyone on these pages."}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {isAr ? "تريد أن تصبح شريكاً؟ " : "Want to become a partner? "}
          <Link href={`/${locale}/contact-us`} className="inline-flex min-h-11 items-center font-semibold text-gold underline underline-offset-4">
            {isAr ? "تواصل مع فريق المبيعات" : "Talk to our sales team"}
          </Link>
        </p>
      </section>
    </MarketingShell>
  );
}
