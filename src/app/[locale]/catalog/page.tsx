import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { CATEGORIES, COMPANY, TOTAL_SKUS, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "المنتجات" : "Products",
    description: isAr
      ? "أقسام منتجات TSH: الحواسيب ومكوّناتها، كاميرات المراقبة، الشبكات، مصادر الطاقة، الطابعات ومستلزماتها، الكهربائيات، الألعاب والحقائب."
      : "TSH product departments: computers and components, CCTV, networking, power supplies, printers and consumables, electrical, gaming and bags.",
    alternates: { canonical: `${COMPANY.website}/${locale}/catalog` },
  };
}

export default async function CatalogPage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";

  return (
    <MarketingShell locale={locale}>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
        {isAr ? "المنتجات" : "Products"}
      </h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
        {isAr
          ? `نوزّع أكثر من ${TOTAL_SKUS.toLocaleString("en-US")} صنف فعّال عبر ثمانية أقسام. القائمة أدناه تعرض ما نحمله في كل قسم.`
          : `We distribute more than ${TOTAL_SKUS.toLocaleString("en-US")} active SKUs across eight departments. The list below shows what we carry in each.`}
      </p>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        {isAr
          ? "نبيع بالجملة للوكلاء والتجّار والمكاتب الفنية. أسعار الجملة وتوفّر المخزون يظهران للشركاء المسجّلين بعد تسجيل الدخول، لأن الأسعار تعاقدية وتختلف بحسب اتفاقية كل شريك."
          : "We sell wholesale to dealers, traders and technical offices. Wholesale prices and live stock are shown to registered partners after login, because pricing is contractual and differs per partner agreement."}
      </p>

      <div className="mt-10 space-y-px overflow-hidden rounded-xl border border-border bg-border">
        {CATEGORIES.map((c) => (
          <section key={c.key} className="bg-card p-6" aria-labelledby={`cat-${c.key}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`cat-${c.key}`} className="font-display text-xl font-bold text-foreground">
                {isAr ? c.ar : c.en}
              </h2>
              <p className="text-sm text-muted-foreground">
                <span dir="ltr" className="font-semibold text-gold">{c.count.toLocaleString("en-US")}</span>
                {isAr ? " صنف فعّال" : " active SKUs"}
              </p>
            </div>
            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">{isAr ? c.arDesc : c.enDesc}</p>
          </section>
        ))}
      </div>

      <section className="mt-10 rounded-xl border border-border bg-muted/40 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-foreground">
          {isAr ? "كيف تشتري منّا" : "How to buy from us"}
        </h2>
        <ol className="mt-4 space-y-3 text-muted-foreground">
          {(isAr
            ? ["تواصل مع فريق المبيعات وقدّم بيانات نشاطك التجاري.", "بعد اعتماد حسابك، تحصل على أسعار الجملة وشروط الدفع الخاصة بك.", "تقدّم طلباتك عبر بوابة الشركاء وتتابع الشحن والتسليم وكشف الحساب."]
            : ["Contact our sales team and provide your business details.", "Once your account is approved, you receive your wholesale prices and payment terms.", "Place orders through the partner portal and track shipping, delivery and your statement."]
          ).map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold" dir="ltr">{i + 1}</span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <Link href={`/${locale}/contact-us`} className="mt-6 inline-flex rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          {isAr ? "تواصل مع المبيعات" : "Contact sales"}
        </Link>
      </section>
    </MarketingShell>
  );
}
