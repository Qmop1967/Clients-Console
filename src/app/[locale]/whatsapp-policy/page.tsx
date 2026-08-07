import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-layout";
import { COMPANY, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }
const UPDATED = "2026-08-07";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "سياسة رسائل واتساب" : "WhatsApp messaging policy",
    description: isAr
      ? `كيف تستخدم ${COMPANY.legalNameAr} واتساب للتواصل مع الزبائن: الموافقة المسبقة، أنواع الرسائل، وإيقافها.`
      : `How ${COMPANY.legalNameEn} uses WhatsApp to contact customers: opt-in, message types, and how to opt out.`,
    alternates: { canonical: `${COMPANY.website}/${locale}/whatsapp-policy` },
  };
}

const AR = [
  { h: "من نحن", p: [
    `هذه السياسة تخصّ ${COMPANY.legalNameAr} ("الشركة" أو "نحن")، ومقرّها ${COMPANY.streetAr}، ${COMPANY.cityAr}، والمسجّلة بموجب ${COMPANY.incorporationAr}.`,
    `نشاطنا هو توزيع الإلكترونيات وملحقات الحاسوب بالجملة داخل العراق. الموقع الرسمي ${COMPANY.website} والبريد ${COMPANY.email} والهاتف ${COMPANY.phoneDisplay}.`,
    "توضّح هذه الصفحة كيف نستخدم واتساب للتواصل مع الزبائن، وكيف نحصل على موافقتك، وما نوع الرسائل التي نرسلها، وكيف يمكنك إيقافها في أي وقت.",
  ]},
  { h: "الموافقة المسبقة", p: [
    "لا نرسل أي رسالة واتساب لشخص لم يطلب استلامها صراحةً. ولا نشتري ولا نستأجر ولا نجمع قوائم أرقام من أي مصدر.",
    "نحصل على الموافقة عبر: مربع اختيار فارغ في نماذج الطلب والاستفسار على الموقع يجب أن تؤشّره بنفسك؛ رموز QR وروابط wa.me على الفواتير والتغليف حيث تبدأ أنت المحادثة؛ إعلانات Click-to-WhatsApp حيث تبدأ أنت التواصل؛ أو طلب خطي لمندوب مبيعات يُسجَّل في أنظمتنا.",
    "نسجّل مع كل موافقة: رقم الهاتف، وتاريخ ووقت الموافقة، والوسيلة المستخدمة، وأنواع الرسائل التي وافق عليها.",
    "الموافقة على إشعارات الطلبات والتوصيل لا تعني الموافقة على الرسائل الترويجية. موافقة التسويق تُجمع بشكل منفصل وصريح.",
  ]},
  { h: "ما الذي نرسله", p: [
    "رسائل خدمية مرتبطة بطلب قدّمته: تأكيد الطلب، الفواتير والوصولات، إشعارات الشحن والتوصيل، وتأكيد الدفع.",
    "رسائل خدمة الزبائن رداً على استفساراتك: توفّر المنتجات ومواصفاتها، حالة الطلب، والدعم بعد البيع.",
    "رسائل تسويقية عن المنتجات الجديدة وعروض الجملة — لمن لديه موافقة تسويق منفصلة ومسجّلة فقط.",
    "ولا نرسل أبداً: رسائل لأرقام بلا موافقة مسجّلة، ولا رسائل جماعية أو عشوائية، ولا محتوى لا علاقة له بنشاطنا، ولا رسائل نيابة عن أي طرف ثالث.",
    "ولن نطلب منك عبر واتساب أرقام بطاقات كاملة أو بيانات حسابات بنكية أو كلمات سر أو رموز تحقق. إذا وصلك طلب كهذا باسمنا فلا تستجب، وتواصل معنا على " + COMPANY.email + ".",
  ]},
  { h: "كيف توقف الرسائل", p: [
    "يمكنك سحب موافقتك في أي وقت ومجاناً: أرسل كلمة الغاء أو STOP رداً على أي رسالة منّا، أو راسلنا على " + COMPANY.email + " مع ذكر رقم الهاتف، أو أخبر أي مندوب مبيعات في الشركة.",
    "الإلغاء يُنفَّذ فوراً وبشكل دائم. يُضاف الرقم إلى قائمة حظر مركزية مُطبَّقة على مستوى أنظمتنا، فلا يستطيع أي تطبيق تابع للشركة مراسلته مجدداً. نرسل رسالة تأكيد واحدة للإلغاء ولا شيء بعدها.",
    "ويمكنك إيقاف الرسائل التسويقية فقط مع الاستمرار باستلام إشعارات الطلبات والتوصيل — فقط أخبرنا بما تريد إيقافه.",
  ]},
  { h: "التعامل مع البيانات", p: [
    "تُستخدم أرقام الهواتف وسجلات الموافقة حصراً للتواصل معك بشأن منتجاتنا وطلباتك.",
    "لا نبيع ولا نؤجّر ولا نشارك رقمك مع أي طرف ثالث لأغراضه التسويقية.",
    "تُحفظ سجلات الموافقة والإلغاء كإثبات امتثال ولضمان استمرار الحظر بعد طلب الإيقاف.",
    `يمكنك طلب حذف بياناتك عبر ${COMPANY.email}، وتُعالج الطلبات وفق سياسة الخصوصية المنشورة على الموقع.`,
  ]},
  { h: "الامتثال", p: [
    "نتواصل عبر منصة واتساب للأعمال الرسمية، ونلتزم بسياسة رسائل واتساب للأعمال وشروط خدمة واتساب للأعمال وسياسات التجارة الخاصة بميتا.",
    "ولا نستخدم أي أدوات واتساب غير رسمية أو واجهات برمجية غير مصرّح بها أو أتمتة تلتف على قواعد المنصة.",
  ]},
  { h: "التحديثات والتواصل", p: [
    `قد نُحدّث هذه السياسة، ويظهر تاريخ آخر تحديث أعلى الصفحة. للاستفسار: ${COMPANY.email} — ${COMPANY.phoneDisplay}.`,
    `${COMPANY.legalNameAr} — ${COMPANY.streetAr}، ${COMPANY.cityAr}.`,
  ]},
];

const EN = [
  { h: "Who we are", p: [
    `This policy applies to ${COMPANY.legalNameEn} ("the Company", "we"), registered under the ${COMPANY.incorporation}, at ${COMPANY.streetEn}, ${COMPANY.cityEn}.`,
    `We are a wholesale distributor of electronics and computer accessories in Iraq. Website ${COMPANY.website}, email ${COMPANY.email}, phone ${COMPANY.phoneDisplay}.`,
    "This page explains how we use WhatsApp to communicate with customers, how we obtain your consent, what messages we send, and how you can stop them at any time.",
  ]},
  { h: "Consent (opt-in)", p: [
    "We do not send WhatsApp messages to anyone who has not explicitly asked to receive them. We never purchase, rent, scrape or import contact lists.",
    "Consent is collected through: an unticked checkbox on order and enquiry forms on this site which the customer must actively select; QR codes and wa.me links on invoices and packaging where the customer starts the conversation; Click-to-WhatsApp advertisements where the customer initiates contact; or a written request to a sales representative, recorded in our system.",
    "For every consent we record the phone number, the date and time, the collection method, and the specific message categories consented to.",
    "Consent to order and delivery notifications does not constitute consent to promotional messages. Marketing consent is collected separately and explicitly.",
  ]},
  { h: "What we send", p: [
    "Utility messages tied to an order you placed: order confirmations, invoices and receipts, dispatch and delivery updates, and payment confirmations.",
    "Customer service replies to your enquiries: product availability and specifications, order status, and after-sales support.",
    "Marketing messages about new products and wholesale offers — only to customers holding a separate, recorded marketing opt-in.",
    "We never send messages to numbers without a recorded consent, bulk or untargeted broadcasts, content unrelated to our business, or messages on behalf of any third party.",
    "We will never ask you for full card numbers, bank account credentials, passwords or verification codes over WhatsApp. If you receive such a request claiming to be from us, do not respond — contact us at " + COMPANY.email + ".",
  ]},
  { h: "How to stop receiving messages", p: [
    "You can withdraw consent at any time, at no cost: reply STOP or الغاء to any message from us, email " + COMPANY.email + " stating the phone number, or tell any of our sales representatives.",
    "Opt-out is honoured immediately and permanently. The number is added to a suppression list enforced centrally in our systems, so no application of ours can message it again. We send one confirmation of the opt-out and nothing further.",
    "You may opt out of marketing messages only while continuing to receive order and delivery notifications — simply tell us which you wish to stop.",
  ]},
  { h: "Data handling", p: [
    "Phone numbers and consent records are used solely to communicate with you about our products and your orders.",
    "We do not sell, rent or share your number with third parties for their own marketing.",
    "Consent and opt-out records are retained as proof of compliance and to keep suppression permanent after an opt-out request.",
    `You may request deletion of your data at ${COMPANY.email}; requests are handled under the privacy policy published on this site.`,
  ]},
  { h: "Compliance", p: [
    "We communicate through the official WhatsApp Business Platform and comply with the WhatsApp Business Messaging Policy, the WhatsApp Business Terms of Service and Meta's Commerce Policies.",
    "We do not use unofficial WhatsApp tools, unauthorised APIs, or automation that circumvents platform rules.",
  ]},
  { h: "Updates and contact", p: [
    `We may update this policy; the last updated date is shown at the top of this page. Questions: ${COMPANY.email} — ${COMPANY.phoneDisplay}.`,
    `${COMPANY.legalNameEn} — ${COMPANY.streetEn}, ${COMPANY.cityEn}.`,
  ]},
];

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return (
    <LegalPage
      locale={locale}
      title={isAr ? "سياسة رسائل واتساب" : "WhatsApp messaging policy"}
      updated={UPDATED}
      sections={isAr ? AR : EN}
    />
  );
}
