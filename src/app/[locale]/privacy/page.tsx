import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { COMPANY, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }
const UPDATED = "2026-07-20";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "سياسة الخصوصية" : "Privacy policy",
    description: isAr
      ? `كيف تجمع ${COMPANY.legalNameAr} بيانات عملائها وتستخدمها وتحميها.`
      : `How ${COMPANY.legalNameEn} collects, uses and protects customer data.`,
    alternates: { canonical: `${COMPANY.website}/${locale}/privacy` },
  };
}

const AR = [
  { h: "من نحن", p: [`هذه السياسة تخصّ ${COMPANY.legalNameAr} ("الشركة" أو "نحن")، ومقرّها ${COMPANY.streetAr}، ${COMPANY.cityAr}. الشركة هي الجهة المسؤولة عن البيانات التي تُجمع عبر موقع ${COMPANY.website} وبوابة الشركاء وقنوات التواصل الرسمية.`] },
  { h: "البيانات التي نجمعها", p: ["اسم الشخص واسم النشاط التجاري، ورقم الهاتف، والبريد الإلكتروني، وعنوان التسليم والمحافظة.", "بيانات الحساب التجاري: الطلبات، الفواتير، المدفوعات، المرتجعات، وكشف الحساب.", "بيانات تقنية محدودة لازمة لتشغيل الموقع: ملفات تعريف الجلسة، وسجلات الأخطاء، ونوع المتصفح.", "لا نجمع أرقام بطاقات الدفع الكاملة ولا كلمات المرور البنكية، ولا نطلب صور وثائق شخصية عبر الرسائل."] },
  { h: "لماذا نستخدمها", p: ["تنفيذ الطلبات وإصدار الفواتير وترتيب التوصيل.", "إدارة الحساب التجاري وكشف الحساب والتحصيل.", "الدعم الفني وخدمة ما بعد البيع والضمان.", "إرسال إشعارات تخصّ الطلب أو الفاتورة أو التسليم إلى من وافق على استلامها.", "الوفاء بالالتزامات المحاسبية والقانونية في العراق."] },
  { h: "الرسائل والموافقة", p: ["نراسل الشركاء في أمور طلباتهم وحساباتهم فقط. لا نرسل رسائل ترويجية إلا لمن وافق صراحةً على ذلك.", `يمكن سحب الموافقة وإيقاف الرسائل في أي وقت بمراسلتنا على ${COMPANY.email}، وننفّذ الطلب فوراً.`, "لا نشتري قوائم أرقام ولا نراسل من لم يتعامل معنا."] },
  { h: "مع من نشاركها", p: ["مندوبو التوصيل وشركات الشحن — بالقدر اللازم لإيصال الطلب فقط.", "قنوات الدفع والتحويل المالي المعتمدة — لتأكيد عمليات الدفع.", "الجهات الرسمية عند وجود التزام قانوني.", "لا نبيع بيانات العملاء ولا نؤجّرها ولا نشاركها لأغراض تسويقية تخصّ طرفاً ثالثاً."] },
  { h: "مدة الاحتفاظ", p: ["نحتفظ بالسجلات التجارية والمحاسبية للمدة التي يفرضها القانون العراقي، وبالبيانات التشغيلية طالما بقي الحساب فعّالاً. عند انتهاء الغرض نحذف البيانات أو نجعلها مجهولة الهوية."] },
  { h: "حماية البيانات", p: ["الوصول إلى بيانات الحسابات مقيّد بالموظفين المخوّلين، والاتصال بالموقع مشفّر عبر HTTPS، والدخول إلى بوابة الشركاء يتم برمز تحقق لمرة واحدة."] },
  { h: "حقوقك", p: [`يحق لك الاطلاع على بياناتك، أو تصحيحها، أو طلب حذفها ضمن ما يسمح به القانون. راسلنا على ${COMPANY.email} أو اتصل على ${COMPANY.phoneDisplay} وسنردّ خلال مدة معقولة.`] },
  { h: "تعديلات السياسة", p: ["قد نحدّث هذه السياسة عند تغيّر خدماتنا أو المتطلّبات القانونية، وسيظهر تاريخ آخر تحديث أعلى الصفحة."] },
];

const EN = [
  { h: "Who we are", p: [`This policy belongs to ${COMPANY.legalNameEn} ("the Company", "we"), based at ${COMPANY.streetEn}, ${COMPANY.cityEn}. We are responsible for data collected through ${COMPANY.website}, our partner portal, and our official contact channels.`] },
  { h: "Data we collect", p: ["Contact person name, business name, phone number, email address, delivery address and province.", "Trade account data: orders, invoices, payments, returns and account statements.", "Limited technical data needed to run the site: session cookies, error logs and browser type.", "We do not collect full payment card numbers or banking passwords, and we never request images of personal identity documents over messaging."] },
  { h: "Why we use it", p: ["Fulfilling orders, issuing invoices and arranging delivery.", "Managing the trade account, statements and collections.", "Technical support, after-sales service and warranty.", "Sending order, invoice and delivery notifications to partners who agreed to receive them.", "Meeting accounting and legal obligations in Iraq."] },
  { h: "Messaging and consent", p: ["We message partners about their own orders and accounts only. We do not send promotional messages unless the recipient has explicitly opted in.", `Consent can be withdrawn and messages stopped at any time by emailing ${COMPANY.email}; we action such requests immediately.`, "We do not buy phone lists and we do not message people who have no business relationship with us."] },
  { h: "Who we share it with", p: ["Delivery agents and shipping companies — only as needed to deliver the order.", "Approved payment and money-transfer channels — to confirm payments.", "Authorities where a legal obligation applies.", "We do not sell, rent or share customer data for third-party marketing."] },
  { h: "Retention", p: ["We keep commercial and accounting records for the period required by Iraqi law, and operational data for as long as the account remains active. When the purpose ends, we delete or anonymise the data."] },
  { h: "Security", p: ["Access to account data is restricted to authorised staff, traffic to the site is encrypted over HTTPS, and partner portal sign-in uses a one-time verification code."] },
  { h: "Your rights", p: [`You may request access to your data, correction of it, or its deletion where the law permits. Email ${COMPANY.email} or call ${COMPANY.phoneDisplay} and we will respond within a reasonable period.`] },
  { h: "Changes to this policy", p: ["We may update this policy as our services or legal requirements change. The last updated date is shown at the top of this page."] },
];

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  const sections = isAr ? AR : EN;

  return (
    <MarketingShell locale={locale}>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
        {isAr ? "سياسة الخصوصية" : "Privacy policy"}
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
