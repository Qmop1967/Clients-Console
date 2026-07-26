'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ConsentProvider, useConsent } from '@/components/analytics/consent-context';
import { ConsentBanner } from '@/components/analytics/consent-banner';
import { loadTikTokPixel, trackPageView } from '@/lib/analytics/tiktok';
import { loadMetaPixel, trackMetaPageView } from '@/lib/analytics/meta';

/**
 * Fires vendor PageView events on client-side navigation after consent.
 * The provider owns the initial/accept PageView. Tracking only when the pathname
 * actually changes prevents a second PageView when status changes to accepted.
 */
function PixelPageView() {
  const { measurementActive } = useConsent();
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!measurementActive) return;
    loadTikTokPixel();
    trackPageView();
    loadMetaPixel();
    trackMetaPageView();
  }, [measurementActive, pathname]);

  return null;
}

/** Single mount point for consent-gated advertising measurement. */
export function MeasurementConsent() {
  return (
    <ConsentProvider>
      <PixelPageView />
      <ConsentBanner />
    </ConsentProvider>
  );
}
