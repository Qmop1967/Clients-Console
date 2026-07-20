import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { CATEGORIES, COMPANY, TOTAL_SKUS, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "من نحن" : "About us",
    description: isAr
      ? `${COMPANY.legalNameAr} — شركة عراقية مسجّلة في بغداد متخصّصة بتوزيع منتجات الحاسبات وأنظمة المراقبة والشبكات بالجملة.`
      : `${COMPANY.legalNameEn} — a registered Iraqi company in Baghdad specialising in wholesale distribution of computer hardware, CCTV and networking products.`,
    alternates: { canonical: `${COMPANY.website}/${locale}/about` },
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";

  const identity = [
    { ar: "الاسم القانوني (عربي)", en: "Legal name (Arabic)", v: COMPANY.legalNameAr, ltr: false },
    { ar: "الاسم القانوني (إنجليزي)", en: "Legal name (English)", v: COMPANY.legalNameEn, ltr: true },
    { ar: "الاسم التجاري", en: "Trading name", v: COMPANY.brand, ltr: true },
    { ar: "التأسيس", en: "Incorporation", v: isAr ? COMPANY.incorporationAr : COMPANY.incorporation, ltr: !isAr },
    { ar: "النشاط", en: "Business activity", v: isAr ? "توزيع جملة لأجهزة ومستلزمات تقنية المعلومات وأنظمة المراقبة" : "Wholesale distribution of IT hardware and security systems", ltr: false },
    { ar: "المقرّ", en: "Head office", v: `${isAr ? COMPANY.streetAr : COMPANY.streetEn} — ${isAr ? COMPANY.cityAr : COMPANY.cityEn}`, ltr: false },
    { ar: "الموقع الإلكتروني", en: "Website", v: COMPANY.website, ltr: true },
  ];

  return (
    <MarketingShell locale={locale}>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
        {isAr ? "من نحن" : "About us"}
      </h1>

      <div className="mt-6 max-w-3xl space-y-4 text-lg leading-relaxed text-muted-foreground">
        <p>
          {isAr
            ? `${COMPANY.legalNameAr} شركة عراقية مسجّلة، مقرّها بغداد، تعمل في استيراد وتوزيع أجهزة ومستلزمات تقنية المعلومات وأنظمة المراقبة بالجملة داخل العراق.`
            : `${COMPANY.legalNameEn} is a registered Iraqi company based in Baghdad. We import and distribute IT hardware and security systems at wholesale inside Iraq.`}
        </p>
        <p>
          {isAr
            ? `عملاؤنا هم الوكلاء وتجّار الجملة والمكاتب الفنية ومقاولو أنظمة المراقبة والشبكات. نحتفظ بمخزون فعّال يتجاوز ${TOTAL_SKUS.toLocaleString("en-US")} صنف موزّع على ثمانية أقسام، ونديره على نظام ERP واحد يربط المخزون والطلبات والحسابات والتوصيل.`
            : `Our customers are dealers, wholesalers, technical offices and contractors installing security and network systems. We hold an active inventory of more than ${TOTAL_SKUS.toLocaleString("en-US")} SKUs across eight departments, managed on a single ERP that connects stock, orders, accounts and delivery.`}
        </p>
        <p>
          {isAr
            ? "نعمل بالبضاعة الأصلية فقط، ونحتفظ بفواتير المورّدين لكل شحنة نستوردها. الضمان يُنفّذ عبر قسم ما بعد البيع لدينا."
            : "We trade in genuine goods only and retain supplier invoices for every shipment we import. Warranty is handled by our own after-sales department."}
        </p>
      </div>

      <section className="mt-12" aria-labelledby="identity">
        <h2 id="identity" className="font-display text-2xl font-bold text-foreground">
          {isAr ? "بيانات الشركة" : "Company details"}
        </h2>
        <dl className="mt-5 overflow-hidden rounded-xl border border-border">
          {identity.map((row, i) => (
            <div key={row.en} className={`grid gap-1 px-5 py-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-6 ${i % 2 ? "bg-card" : "bg-muted/30"}`}>
              <dt className="text-sm font-semibold text-muted-foreground">{isAr ? row.ar : row.en}</dt>
              <dd className="text-foreground" dir={row.ltr ? "ltr" : undefined}>{row.v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          {isAr
            ? "شهادة تسجيل الشركة وتسجيل غرفة تجارة بغداد والتسجيل الضريبي متاحة عند الطلب للجهات الرسمية والشركاء."
            : "Company registration certificate, Baghdad Chamber of Commerce registration and tax registration are available on request to authorities and partners."}
        </p>
      </section>

      <section className="mt-12" aria-labelledby="depts">
        <h2 id="depts" className="font-display text-2xl font-bold text-foreground">
          {isAr ? "أقسامنا" : "Our departments"}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <li key={c.key} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground">
              {isAr ? c.ar : c.en}
              <span className="ms-2 text-muted-foreground" dir="ltr">{c.count.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-xl border border-border bg-muted/40 p-6" aria-labelledby="compliance">
        <h2 id="compliance" className="font-display text-xl font-bold text-foreground">
          {isAr ? "التزامنا" : "Our commitments"}
        </h2>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          {(isAr
            ? [
                "نبيع بضاعة أصلية فقط، ولا نتعامل بالمنتجات المقلّدة.",
                "لا نبيع أي صنف محظور أو خاضع لقيود قانونية في العراق.",
                "نراسل عملاءنا في أمور طلباتهم وحساباتهم فقط، وبناءً على موافقتهم.",
                "نحترم حقوق الملكية الفكرية للعلامات التي نوزّع منتجاتها.",
              ]
            : [
                "We sell genuine goods only and do not deal in counterfeit products.",
                "We do not sell any item that is prohibited or legally restricted in Iraq.",
                "We message customers about their own orders and accounts only, and only with their consent.",
                "We respect the intellectual property rights of the brands whose products we distribute.",
              ]
          ).map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
