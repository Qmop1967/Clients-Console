'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { COMPANY, toMarketingLocale } from '@/lib/marketing/company';
import { trackEvent } from '@/lib/analytics/tiktok';

const CONSENT_GRANTED_EVENT = 'tsh:tiktok-consent-granted';

const eventProperties = {
  content_name: 'PowerPluse Laptop AC Adapters',
  content_category: 'Laptop AC Adapters',
} as const;

function trackCampaignView(): void {
  trackEvent('ViewCatalog', eventProperties);
}

export function AcAdapterCampaignView() {
  useEffect(() => {
    trackCampaignView();
    window.addEventListener(CONSENT_GRANTED_EVENT, trackCampaignView);
    return () => {
      window.removeEventListener(CONSENT_GRANTED_EVENT, trackCampaignView);
    };
  }, []);

  return null;
}

export function AcAdapterCampaignActions({ locale }: { locale: string }) {
  const isAr = toMarketingLocale(locale) === 'ar';

  const trackContact = (method: 'phone' | 'email') => {
    trackEvent('Contact', {
      ...eventProperties,
      content_name: `PowerPluse Laptop AC Adapters - ${method}`,
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={`tel:${COMPANY.phone}`}
        onClick={() => trackContact('phone')}
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gold px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {isAr ? 'اتصل للحصول على عرض الجملة' : 'Call for a wholesale quote'}
      </a>
      <a
        href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(
          isAr ? 'طلب عرض جملة — شواحن لابتوب' : 'Wholesale quote — laptop AC adapters'
        )}`}
        onClick={() => trackContact('email')}
        className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {isAr ? 'راسل فريق المبيعات' : 'Email sales'}
      </a>
      <Link
        href={`/${locale}/catalog`}
        onClick={() => trackEvent('ClickButton', eventProperties)}
        className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {isAr ? 'تصفّح الكتالوج' : 'Browse the catalog'}
      </Link>
    </div>
  );
}
