'use client';

import { useLocale } from 'next-intl';
import { Cookie } from 'lucide-react';
import Link from 'next/link';
import { pixelEnabled, useConsent } from '@/components/analytics/consent-context';
import { toMarketingLocale } from '@/lib/marketing/company';

/**
 * Consent UI for the TikTok and Meta measurement pixels.
 * - Before a decision: a bottom banner offering Accept / Reject.
 * - After a decision: a small floating control to change/withdraw consent.
 * Renders nothing when neither vendor has a pixel id configured.
 */
export function ConsentBanner() {
  const locale = useLocale();
  const { status, ready, accept, reject, reset } = useConsent();
  const isAr = toMarketingLocale(locale) === 'ar';

  // No pixel configured, or localStorage not yet read: render nothing (no flash).
  if (!pixelEnabled() || !ready) return null;

  if (status === 'unset') {
    return (
      <div
        role="dialog"
        aria-live="polite"
        aria-label={isAr ? 'إعداد الخصوصية' : 'Privacy preferences'}
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 px-4 py-4 shadow-lg backdrop-blur"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? 'نستخدم أدوات قياس TikTok وMeta بعد موافقتك فقط. قد تُرسل الصفحة ونوع الحدث ومعرّفات المتصفح، ولأحداث التجارة معرّفات المنتجات والكميات والأسعار وقيمة الطلب والعملة. لا نرسل الاسم أو الهاتف أو البريد أو بيانات بطاقة الدفع أو الحساب البنكي.'
              : 'We use TikTok and Meta measurement tools only after you consent. We may send the page, event type and browser identifiers and, for commerce events, product IDs, quantities, prices, order value and currency. We do not send your name, phone, email, payment-card details or bank-account credentials.'}{' '}
            <Link
              href={`/${locale}/privacy`}
              className="font-semibold text-gold underline-offset-2 hover:underline"
            >
              {isAr ? 'سياسة الخصوصية' : 'Privacy policy'}
            </Link>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={reject}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isAr ? 'رفض' : 'Reject'}
            </button>
            <button
              type="button"
              onClick={accept}
              className="inline-flex min-h-11 items-center rounded-lg bg-gold px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isAr ? 'موافقة' : 'Accept'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Decision made: offer a way to change/withdraw it.
  return (
    <button
      type="button"
      onClick={reset}
      aria-label={isAr ? 'تغيير إعداد الخصوصية' : 'Change privacy preferences'}
      title={isAr ? 'تغيير إعداد الخصوصية' : 'Change privacy preferences'}
      className="fixed bottom-4 z-[55] inline-flex size-11 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground shadow-md backdrop-blur transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ltr:left-4 rtl:right-4"
    >
      <Cookie className="size-5" aria-hidden />
    </button>
  );
}
