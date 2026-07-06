"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";

/**
 * ShopHero — bold gradient header band for the shop.
 * Greets the customer by first name when authenticated, otherwise shows the
 * generic store title. Purely presentational (search stays in the grid below).
 */
export function ShopHero() {
  const t = useTranslations("products");
  const { data: session } = useSession();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];

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

        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
          {firstName ? t("heroGreeting", { name: firstName }) : t("heroTitle")}
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground mt-1.5 max-w-xl">
          {t("heroSubtitle")}
        </p>
      </div>
    </div>
  );
}
