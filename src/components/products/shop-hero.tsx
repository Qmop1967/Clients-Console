"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Sparkles, BadgeCheck } from "lucide-react";

/**
 * ShopHero — bold gradient header band for the shop.
 * Greets the customer with their FULL account name (formal wording) when
 * authenticated, shows a verified-account badge and account facts:
 * customer number, generic price tier, and currency.
 *
 * PRIVACY: the visible price tier is a fixed generic label for ALL
 * customers ("تاجر جملة" / "Wholesale Trader"). The internal pricelist
 * tier (Wholesale A/B, Retailer, IQD/USD) is NEVER rendered anywhere.
 */
export function ShopHero() {
  const t = useTranslations("products");
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string | null; odooPartnerId?: string; currencyCode?: string }
    | undefined;

  const displayName = user?.name?.trim();
  const customerNo = user?.odooPartnerId ? String(user.odooPartnerId) : undefined;
  const currencyCode = user?.currencyCode;

  const factClass =
    "inline-flex items-center gap-1 rounded-full bg-background/70 border border-border/60 px-3 py-1 text-[11px] text-muted-foreground";

  return (
    <div className="relative overflow-hidden rounded-2xl gradient-hero border border-primary/15 px-5 py-6 sm:px-8 sm:py-9">
      {/* Decorative glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 -start-8 w-40 h-40 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -end-6 w-56 h-56 bg-primary/15 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2.5 rounded-full bg-gold/15 border border-gold/25 text-[11px] font-medium text-gold-dark dark:text-gold">
          <Sparkles className="h-3 w-3" />
          {t("heroBadge")}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold leading-tight flex items-center gap-2.5 flex-wrap">
          <span>{displayName ? t("heroGreeting", { name: displayName }) : t("heroTitle")}</span>
          {displayName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t("heroVerified")}
            </span>
          )}
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground mt-1.5 max-w-xl">
          {t("heroSubtitle")}
        </p>

        {displayName && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {customerNo && (
              <span className={factClass}>
                {t("heroCustomerNo")}:
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
      </div>
    </div>
  );
}
