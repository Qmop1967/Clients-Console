'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Cookie, X } from 'lucide-react';
import Link from 'next/link';
import { pixelEnabled, useConsent } from '@/components/analytics/consent-context';
import { toMarketingLocale } from '@/lib/marketing/company';

/**
 * Consent UI for the TikTok and Meta measurement pixels. Three states:
 *
 *  - status 'unset'            → a blocking Accept / Reject choice. Prior-consent regions
 *                                (EU/EEA/UK/CH) land here; nothing measures until a click.
 *  - accepted, basis 'implied' → a non-blocking NOTICE with a one-click opt-out. This is
 *                                the legitimate-interest path used outside those regions.
 *  - anything else             → a small floating control to change/withdraw the decision.
 *
 * The notice is dismissible per session (sessionStorage), because implied consent is not
 * persisted and would otherwise reappear on every page view. Dismissing hides the bar, not
 * the ability to opt out — the floating control stays.
 */

const NOTICE_DISMISSED_KEY = 'tsh_measurement_notice_dismissed';

export function ConsentBanner() {
  const locale = useLocale();
  const { status, basis, ready, accept, reject, reset } = useConsent();
  const isAr = toMarketingLocale(locale) === 'ar';
  const [noticeDismissed, setNoticeDismissed] = useState(true);

  // Read the per-session dismissal after mount so SSR and first paint agree.
  useEffect(() => {
    try {
      setNoticeDismissed(window.sessionStorage.getItem(NOTICE_DISMISSED_KEY) === '1');
    } catch {
      setNoticeDismissed(false);
    }
  }, []);

  const dismissNotice = () => {
    try {
      window.sessionStorage.setItem(NOTICE_DISMISSED_KEY, '1');
    } catch {
      /* private mode — the bar simply returns next page view */
    }
    setNoticeDismissed(true);
  };

  // No pixel configured, or localStorage not yet read: render nothing (no flash).
  if (!pixelEnabled() || !ready) return null;

  const privacyLink = (
    <Link
      href={`/${locale}/privacy`}
      className="font-semibold text-gold underline-offset-2 hover:underline"
    >
      {isAr ? 'سياسة الخصوصية' : 'Privacy policy'}
    </Link>
  );

  // ── Prior-consent region: nothing measures until an explicit click ────────────
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
            {privacyLink}
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

  // ── Legitimate interest: measuring, with a plain notice and a one-click opt-out ──
  if (status === 'accepted' && basis === 'implied' && !noticeDismissed) {
    return (
      <div
        role="region"
        aria-live="polite"
        aria-label={isAr ? 'إشعار القياس' : 'Measurement notice'}
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? 'نقيس أداء إعلاناتنا بأدوات TikTok وMeta لتحسين ما نعرضه. لا نرسل اسمك أو هاتفك أو بريدك أو بيانات الدفع.'
              : 'We measure our advertising performance with TikTok and Meta tools to improve what we show you. We never send your name, phone, email or payment details.'}{' '}
            {privacyLink}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={reject}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isAr ? 'إيقاف القياس' : 'Turn off'}
            </button>
            <button
              type="button"
              onClick={dismissNotice}
              aria-label={isAr ? 'إغلاق الإشعار' : 'Dismiss notice'}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Decision made (or notice dismissed): keep a way to change or withdraw it ──
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
