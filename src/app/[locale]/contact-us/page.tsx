import type { Metadata } from "next";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { whatsappSalesLink } from "@/lib/config/contact";
import Link from "next/link";
import { COMPANY, toMarketingLocale } from "@/lib/marketing/company";

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";
  return {
    title: isAr ? "تواصل معنا" : "Contact us",
    description: isAr
      ? `تواصل مع ${COMPANY.legalNameAr} — ${COMPANY.streetAr}. واتساب ${COMPANY.phoneDisplay}`
      : `Contact ${COMPANY.legalNameEn} — ${COMPANY.streetEn}. WhatsApp ${COMPANY.phoneDisplay}`,
    alternates: { canonical: `${COMPANY.website}/${locale}/contact-us` },
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const isAr = toMarketingLocale(locale) === "ar";

  const cards = [
    { icon: MapPin, label: isAr ? "المقرّ" : "Head office",
      lines: [isAr ? COMPANY.streetAr : COMPANY.streetEn], ltr: false },
    // Khaleel (2026-09-19): email is not monitored — contact is WhatsApp or the registration form.
    { icon: MessageCircle, label: isAr ? "واتساب" : "WhatsApp", lines: [COMPANY.phoneDisplay], href: whatsappSalesLink(isAr ? "مرحباً، عندي استفسار" : "Hello, I have a question"), ltr: true },
    { icon: Clock, label: isAr ? "ساعات العمل" : "Business hours", lines: [isAr ? COMPANY.hoursAr : COMPANY.hoursEn], ltr: false, wide: true },
  ];

  return (
    <MarketingShell locale={locale}>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
        {isAr ? "تواصل معنا" : "Contact us"}
      </h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
        {isAr
          ? "مكتبنا في بغداد مفتوح للزيارة خلال ساعات العمل. لأي استفسار راسلنا على واتساب، ولفتح حساب تاجر سجّل مباشرة من الاستمارة."
          : "Our Baghdad office is open for visits during business hours. For any question message us on WhatsApp; to open a trader account, register directly using the form."}
      </p>

      {/* Two columns: details on the reading side, actions in what would otherwise
          be dead space on the left of an RTL layout. */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_minmax(0,23rem)]">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {cards.map(({ icon: Icon, label, lines, href, ltr, wide }: { icon: typeof Clock; label: string; lines: string[]; href?: string; ltr: boolean; wide?: boolean }) => (
            <div key={label} className={`bg-card p-6${wide ? " sm:col-span-2" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="text-base font-semibold text-foreground">{label}</h2>
              </div>
              <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground" dir={ltr ? "ltr" : undefined}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-medium text-foreground hover:text-gold">
                    {lines[0]}
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
                ? "نبيع بالجملة للوكلاء والتجّار والمكاتب الفنية. سجّل بنفسك خلال دقائق من الاستمارة أدناه — نتحقق من بريدك ورقم هاتفك ثم صور محلك، ويُفعَّل حسابك بعد المراجعة. أو راسلنا على واتساب إن كان عندك سؤال."
                : "We sell wholesale to dealers, traders and technical offices. Register yourself in minutes using the form below — we verify your email and phone, then your shop photos, and your account is activated after review. Or message us on WhatsApp if you have a question."}
            </p>
            <Link
              href={`/${locale}/register`}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-gold px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {isAr ? "ابدأ التسجيل الآن" : "Start registration"}
            </Link>
            <a
              href={whatsappSalesLink(isAr ? "مرحباً، أريد فتح حساب تاجر جملة" : "Hello, I would like to open a wholesale account")}
              target="_blank" rel="noopener noreferrer"
              className="mt-2.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <MessageCircle className="size-4" aria-hidden />
              {isAr ? "راسلنا على واتساب" : "Message us on WhatsApp"}
            </a>
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-6" aria-labelledby="msg">
            <h2 id="msg" className="font-display text-lg font-bold text-foreground">
              {isAr ? "كيف نراسل عملاءنا" : "How we message customers"}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {isAr
                ? "نرسل رسائل تتعلّق بالطلبات والفواتير والتوصيل وكشوف الحساب إلى الشركاء المسجّلين الذين وافقوا على استلامها. لا نرسل رسائل ترويجية لمن لم يوافق، ويمكن إيقاف الرسائل في أي وقت بمراسلتنا على واتساب."
                : "We send order, invoice, delivery and account-statement messages to registered partners who have agreed to receive them. We do not send promotional messages to anyone who has not opted in, and messages can be stopped at any time by messaging us on WhatsApp."}
            </p>
          </section>
        </div>
      </div>
    </MarketingShell>
  );
}
