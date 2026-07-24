"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ConsentProvider, useConsent } from "@/components/analytics/consent-context";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { trackPageView } from "@/lib/analytics/tiktok";

/**
 * Fires PageView on client-side navigation — but only once consent is "accepted".
 * The very first PageView (initial load / the moment of Accept) is fired by the
 * provider, so we skip the mount render here to avoid a duplicate hit.
 */
function PixelPageView() {
  const { status } = useConsent();
  const pathname = usePathname();
  const skippedMount = useRef(false);

  useEffect(() => {
    if (!skippedMount.current) {
      skippedMount.current = true;
      return;
    }
    if (status === "accepted") trackPageView();
  }, [pathname, status]);

  return null;
}

/** Single mount point for the consent-gated TikTok Pixel. Place in the locale body. */
export function TikTokConsent() {
  return (
    <ConsentProvider>
      <PixelPageView />
      <ConsentBanner />
    </ConsentProvider>
  );
}
