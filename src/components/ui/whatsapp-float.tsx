"use client";

import { useTranslations } from "next-intl";
import { whatsappSalesLink } from "@/lib/config/contact";

/**
 * WhatsAppFloat — always-reachable sales line (the #1 conversation channel
 * for Iraqi traders). Fixed inside the viewport; sits above the mobile bottom
 * nav (bottom-20) and drops to bottom-6 on desktop where there is no nav.
 * z-40 keeps it under the header dropdowns (z-50+/z-[80]).
 */
export function WhatsAppFloat() {
  const t = useTranslations("common");

  return (
    <a
      href={whatsappSalesLink(t("whatsappPrefill"))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappSales")}
      title={t("whatsappSales")}
      className="fixed bottom-20 end-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-emerald-900/30 transition-transform native-press hover:scale-105 md:bottom-6 md:end-6"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.4-.1.7.1.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.4 0 .1 0 .7-.2 1.1z" />
      </svg>
    </a>
  );
}
