import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { COMPANY, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }
const UPDATED = "2026-07-20";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "الشروط والأحكام" : "Terms of service",
    description: isAr
      ? `شروط استخدام موقع وبوابة شركاء ${COMPANY.legalNameAr}.`
      : `Terms governing the use of the ${COMPANY.legalNameEn} website and partner portal.`,
    alternates: { canonical: `${COMPANY.website}/${locale}/terms` },
  };
}

const AR = [
  { h: "نطاق هذه الشروط", p: [`تنظّم هذه الشروط استخدام موقع ${COMPANY.website} وبوابة الشركاء التابعة لـ ${COMPANY.legalNameAr}. باستخدامك الموقع فإنك توافق عليها.`] },
  { h: "طبيعة النشاط", p: ["نحن موزّع جملة. البيع موجّه إلى الوكلاء وتجّار الجملة والمكاتب الفنية والمقاولين، وليس بيعاً بالمفرد للمستهلك النهائي.", "الصفحات العامة على الموقع تعريفية. الطلب الفعلي يتم عبر بوابة الشركاء بعد اعتماد الحساب."] },
  { h: "الحسابات", p: ["يُفتح الحساب التجاري بعد تقديم بيانات النشاط والموافقة عليها من فريق المبيعات.", "الدخول يتم برمز تحقق يُرسل إلى هاتف أو بريد صاحب الحساب، وصاحب الحساب مسؤول عن حماية وسيلة الدخول.", "يحق لنا إيقاف أي حساب عند إساءة الاستخدام أو مخالفة هذه الشروط."] },
  { h: "الأسعار والطلبات", p: ["الأسعار تعاقدية وتختلف بحسب اتفاقية كل شريك، وتظهر داخل البوابة بعد تسجيل الدخول.", "الأسعار قابلة للتغيير، والطلب لا يُعدّ ملزماً إلا بعد تأكيده من الشركة وتوفّر الكمية.", "قد تُعرض الأسعار بالدينار العراقي أو الدولار الأمريكي بحسب اتفاق الحساب."] },
  { h: "الدفع", p: ["تُحدَّد شروط الدفع لكل شريك عند اعتماد حسابه، وتشمل الدفع النقدي أو التحويل أو الآجل للحسابات المعتمدة.", "تأخّر السداد قد يؤدي إلى إيقاف التوريد إلى حين التسوية."] },
  { h: "التوصيل", p: ["نوصّل داخل العراق عبر مندوبينا أو شركات شحن. تُحدَّد المدة والكلفة بحسب المحافظة وحجم الطلب.", "على المستلم فحص الشحنة عند التسليم وتسجيل أي نقص أو تلف ظاهر في حينه."] },
  { h: "المرتجعات والضمان", p: ["تُقبل المرتجعات ضمن المدة والشروط المتفق عليها في الحساب، وبحالة المنتج وتغليفه الأصلي.", "الضمان يُنفّذ عبر قسم ما بعد البيع لدينا وفق شروط الضمان الخاصة بكل صنف ومورّده.", "لا يشمل الضمان سوء الاستخدام أو التلف الناتج عن التركيب الخاطئ أو تذبذب التيار."] },
  { h: "الاستخدام المقبول", p: ["يُمنع استخدام الموقع أو البوابة لأي غرض غير قانوني، أو لمحاولة الوصول إلى بيانات حسابات أخرى، أو لسحب البيانات آلياً دون إذن.", "يُمنع إعادة نشر أسعارنا التعاقدية أو بيانات حسابك لأطراف ثالثة."] },
  { h: "الملكية الفكرية", p: ["اسم TSH وشعارها ومحتوى هذا الموقع مملوكة للشركة. أسماء وعلامات المنتجات التي نوزّعها تعود لأصحابها، ونستخدمها للتعريف بالمنتج فقط."] },
  { h: "حدود المسؤولية", p: ["نبذل جهداً معقولاً لدقّة المعلومات والمواصفات المعروضة، لكنها قد تتغيّر من المصنّع. مسؤوليتنا تقتصر على قيمة الطلب محلّ النزاع."] },
  { h: "القانون الواجب التطبيق", p: ["تخضع هذه الشروط للقوانين النافذة في جمهورية العراق، وتختصّ محاكم بغداد بأي نزاع ينشأ عنها."] },
  { h: "التعديلات والتواصل", p: [`قد نعدّل هذه الشروط، ويظهر تاريخ آخر تحديث أعلى الصفحة. للاستفسار: ${COMPANY.email} — ${COMPANY.phoneDisplay}.`] },
];

const EN = [
  { h: "Scope", p: [`These terms govern use of ${COMPANY.website} and the partner portal operated by ${COMPANY.legalNameEn}. By using the site you accept them.`] },
  { h: "Nature of our business", p: ["We are a wholesale distributor. We sell to dealers, wholesalers, technical offices and contractors, not retail to end consumers.", "The public pages on this site are informational. Actual ordering happens in the partner portal once an account is approved."] },
  { h: "Accounts", p: ["A trade account is opened after business details are submitted and approved by our sales team.", "Sign-in uses a one-time code sent to the account holder's phone or email; the account holder is responsible for protecting that access.", "We may suspend any account for misuse or breach of these terms."] },
  { h: "Pricing and orders", p: ["Prices are contractual and vary by partner agreement; they are shown inside the portal after login.", "Prices may change, and an order becomes binding only once we confirm it and stock is available.", "Prices may be quoted in Iraqi dinar or US dollar depending on the account agreement."] },
  { h: "Payment", p: ["Payment terms are set per partner when the account is approved and may include cash, transfer, or credit terms for approved accounts.", "Overdue balances may lead to supply being paused until settlement."] },
  { h: "Delivery", p: ["We deliver inside Iraq through our own agents or shipping companies. Time and cost depend on province and order size.", "The recipient should inspect the shipment on delivery and record any shortage or visible damage at that time."] },
  { h: "Returns and warranty", p: ["Returns are accepted within the period and conditions agreed on the account, with the product and its original packaging intact.", "Warranty is handled by our after-sales department according to the warranty terms of each item and its supplier.", "Warranty does not cover misuse, incorrect installation, or damage caused by power fluctuation."] },
  { h: "Acceptable use", p: ["The site and portal may not be used for unlawful purposes, to attempt access to other accounts, or for automated data extraction without permission.", "Republishing our contractual prices or your account data to third parties is not permitted."] },
  { h: "Intellectual property", p: ["The TSH name, logo and the content of this site belong to the Company. Product names and marks of the brands we distribute belong to their owners and are used for product identification only."] },
  { h: "Limitation of liability", p: ["We make reasonable efforts to keep displayed information and specifications accurate, but manufacturers may change them. Our liability is limited to the value of the order in dispute."] },
  { h: "Governing law", p: ["These terms are governed by the laws of the Republic of Iraq, and the courts of Baghdad have jurisdiction over any dispute arising from them."] },
  { h: "Changes and contact", p: [`We may amend these terms; the last updated date is shown at the top of this page. Questions: ${COMPANY.email} — ${COMPANY.phoneDisplay}.`] },
];

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  const sections = isAr ? AR : EN;

  return (
    <MarketingShell locale={locale}>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
        {isAr ? "الشروط والأحكام" : "Terms of service"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {isAr ? "آخر تحديث: " : "Last updated: "}<span dir="ltr">{UPDATED}</span>
      </p>
      <div className="mt-10 max-w-3xl space-y-9">
        {sections.map((s) => (
          <section key={s.h} aria-labelledby={s.h}>
            <h2 id={s.h} className="font-display text-xl font-bold text-foreground">{s.h}</h2>
            <div className="mt-3 space-y-2.5">
              {s.p.map((line) => (
                <p key={line} className="leading-relaxed text-muted-foreground">{line}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MarketingShell>
  );
}
