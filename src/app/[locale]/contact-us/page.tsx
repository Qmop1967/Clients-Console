import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { MarketingShell, PlainEmail } from "@/components/marketing/marketing-chrome";
import { COMPANY, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "تواصل معنا" : "Contact us",
    description: isAr
      ? `تواصل مع ${COMPANY.legalNameAr} — ${COMPANY.streetAr}، ${COMPANY.cityAr}. هاتف ${COMPANY.phoneDisplay} — بريد ${COMPANY.email}`
      : `Contact ${COMPANY.legalNameEn} — ${COMPANY.streetEn}, ${COMPANY.cityEn}. Phone ${COMPANY.phoneDisplay} — email ${COMPANY.email}`,
    alternates: { canonical: `${COMPANY.website}/${locale}/contact-us` },
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";

  const cards = [
    { icon: MapPin, label: isAr ? "المقرّ" : "Head office",
      lines: [isAr ? COMPANY.streetAr : COMPANY.streetEn, isAr ? COMPANY.cityAr : COMPANY.cityEn], ltr: false },
    { icon: Phone, label: isAr ? "الهاتف" : "Phone", lines: [COMPANY.phoneDisplay], href: `tel:${COMPANY.phone}`, ltr: true },
    { icon: Mail, label: isAr ? "البريد الإلكتروني" : "Email", lines: [COMPANY.email], href: `mailto:${COMPANY.email}`, ltr: true },
    { icon: Clock, label: isAr ? "ساعات العمل" : "Business hours", lines: [isAr ? COMPANY.hoursAr : COMPANY.hoursEn], ltr: false },
  ];

  return (
    <MarketingShell locale={locale}>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
        {isAr ? "تواصل معنا" : "Contact us"}
      </h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
        {isAr
          ? "مكتبنا في بغداد مفتوح للزيارة خلال ساعات العمل، ويسعدنا استقبال استفساراتك بالهاتف أو البريد الإلكتروني."
          : "Our Baghdad office is open for visits during business hours, and we are glad to take your enquiries by phone or email."}
      </p>

      {/* Two columns: details on the reading side, actions in what would otherwise
          be dead space on the left of an RTL layout. */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_minmax(0,23rem)]">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {cards.map(({ icon: Icon, label, lines, href, ltr }) => (
            <div key={label} className="bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="font-semibold text-foreground">{label}</h2>
              </div>
              <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground" dir={ltr ? "ltr" : undefined}>
                {href ? (
                  <a href={href} className="inline-flex min-h-11 items-center font-medium text-foreground hover:text-gold">
                    {href.startsWith("mailto:") ? <PlainEmail /> : lines[0]}
                  </a>
                ) : (
                  lines.map((l) => <p key={l}>{l}</p>)
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-gold/30 bg-gold/5 p-6" aria-labelledby="partner">
            <h2 id="partner" className="font-display text-xl font-bold text-foreground">
              {isAr ? "لتصبح شريكاً تجارياً" : "Becoming a trade partner"}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {isAr
                ? "نبيع بالجملة للوكلاء والتجّار والمكاتب الفنية. راسلنا واذكر اسم نشاطك التجاري، والمحافظة، ونوع المنتجات التي تهمّك، وسيتواصل معك فريق المبيعات لفتح حسابك."
                : "We sell wholesale to dealers, traders and technical offices. Email us with your business name, your province, and the product categories you are interested in, and our sales team will get in touch to open your account."}
            </p>
            <a
              href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(isAr ? "طلب فتح حساب تاجر جملة" : "Wholesale account request")}`}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-gold px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {isAr ? "راسلنا بالبريد الإلكتروني" : "Email us"}
            </a>
            <a
              href={`tel:${COMPANY.phone}`}
              className="mt-2.5 inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {isAr ? "اتصل بنا" : "Call us"}
            </a>
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-6" aria-labelledby="msg">
            <h2 id="msg" className="font-display text-lg font-bold text-foreground">
              {isAr ? "كيف نراسل عملاءنا" : "How we message customers"}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {isAr
                ? "نرسل رسائل تتعلّق بالطلبات والفواتير والتوصيل وكشوف الحساب إلى الشركاء المسجّلين الذين وافقوا على استلامها. لا نرسل رسائل ترويجية لمن لم يوافق، ويمكن إيقاف الرسائل في أي وقت بمراسلتنا على البريد أعلاه."
                : "We send order, invoice, delivery and account-statement messages to registered partners who have agreed to receive them. We do not send promotional messages to anyone who has not opted in, and messages can be stopped at any time by emailing the address above."}
            </p>
          </section>
        </div>
      </div>
    </MarketingShell>
  );
}
