"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { BadgeCheck, ReceiptText, PackageSearch, FileText, ChevronLeft } from "lucide-react";

/**
 * ShopHero — compact account strip (redesign 2026-07-17).
 *
 * The old hero was a ~⅓-viewport gradient band repeating account facts that
 * already live in the header AccountChip, with the start half of the band
 * empty. Prime real estate now works for its living:
 *   - one slim row: greeting + verified badge + account facts + a
 *     "prices updated daily" trust chip (wholesale buyers compare daily);
 *   - a B2B quick-actions row (my orders / statement / invoices) that saves
 *     the daily repeat-buyer a trip through the dashboard;
 *   - the freed vertical space hosts the admin-managed PromoSlider (rendered
 *     by the parent right below this strip).
 *
 * PRIVACY: the visible price tier stays the fixed generic label for ALL
 * customers ("تاجر جملة" / "Wholesale Trader"). The internal pricelist
 * tier (Wholesale A/B, Retailer, IQD/USD) is NEVER rendered anywhere.
 */
export function ShopHero() {
  const t = useTranslations("products");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string | null; odooPartnerId?: string; currencyCode?: string }
    | undefined;

  const displayName = user?.name?.trim();
  const customerNo = user?.odooPartnerId ? String(user.odooPartnerId) : undefined;
  const currencyCode = user?.currencyCode;

  const factClass =
    "inline-flex items-center gap-1 rounded-full bg-background/70 border border-border/60 px-2.5 py-0.5 text-[11px] text-muted-foreground";

  const quickLinks = [
    { href: `/${locale}/orders`, label: tNav("orders"), sub: t("quickReorderHint"), Icon: PackageSearch },
    { href: `/${locale}/account-statement`, label: tNav("accountStatement"), sub: t("quickStatementHint"), Icon: ReceiptText },
    { href: `/${locale}/invoices`, label: tNav("invoices"), sub: t("quickInvoicesHint"), Icon: FileText },
  ];

  return (
    <div className="space-y-3">
      {/* Compact identity strip */}
      <div className="relative overflow-hidden rounded-2xl gradient-hero border border-primary/15 px-4 py-3.5 sm:px-6 sm:py-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-12 -start-10 w-36 h-36 bg-gold/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-14 -end-8 w-44 h-44 bg-primary/15 rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-base sm:text-lg font-bold leading-tight">
            {displayName ? t("heroGreeting", { name: displayName }) : t("heroTitle")}
          </h1>

          {displayName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t("heroVerified")}
            </span>
          )}

          {displayName && (
            <div className="flex flex-wrap items-center gap-1.5">
              {customerNo && (
                <span className={factClass}>
                  {t("heroCustomerNo")}
                  <b className="text-foreground font-semibold" dir="ltr">#{customerNo}</b>
                </span>
              )}
              <span className={factClass}>
                {t("heroPriceTier")}:
                <b className="text-foreground font-semibold">{t("heroPriceTierValue")}</b>
              </span>
              {currencyCode && (
                <span className={factClass}>
                  {t("heroCurrency")}:
                  <b className="text-foreground font-semibold" dir="ltr">{currencyCode}</b>
                </span>
              )}
            </div>
          )}

          {/* Trust chip — wholesale buyers compare prices daily */}
          <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t("pricesFresh")}
          </span>
        </div>
      </div>

      {/* B2B quick actions — authenticated customers only */}
      {displayName && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {quickLinks.map(({ href, label, sub, Icon }) => (
            <Link
              key={href}
              prefetch={false}
              href={href}
              className="group flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 native-press transition-all hover:border-gold/40 hover:shadow-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold-dark dark:text-gold">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-bold">{label}</span>
                <span className="hidden truncate text-[10.5px] text-muted-foreground sm:block">{sub}</span>
              </span>
              <ChevronLeft className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:-translate-x-0.5 sm:block rtl:rotate-0 ltr:rotate-180" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
