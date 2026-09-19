'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { X } from 'lucide-react';
import Link from 'next/link';
import { pixelEnabled, useConsent } from '@/components/analytics/consent-context';
import { toMarketingLocale } from '@/lib/marketing/company';

/**
 * Consent UI for the TikTok and Meta measurement pixels.
 *
 * Khaleel (2026-09-19): the old bar was a tall sheet that covered the page and came
 * back on every visit, plus a floating cookie button that never went away. Rules now:
 *
 *  - status 'unset' (EU/UK/CH, or a VPN exit there) → a slim one-line Accept / Reject
 *    bar. The decision is persisted, so it is asked once.
 *  - accepted, basis 'implied' (Iraq and everywhere else) → a slim notice shown ONCE;
 *    closing it is remembered in localStorage (it used to be per-session, which is why
 *    it kept coming back).
 *  - otherwise → nothing on screen. Changing the decision lives in the footer link
 *    "إعدادات الخصوصية", which fires PRIVACY_SETTINGS_EVENT.
 */

export const PRIVACY_SETTINGS_EVENT = 'tsh:open-privacy-settings';
const NOTICE_ACK_KEY = 'tsh_measurement_notice_ack_v2';

const safeGet = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } };

export function ConsentBanner() {
  const locale = useLocale();
  const { status, basis, ready, accept, reject, reset } = useConsent();
  const isAr = toMarketingLocale(locale) === 'ar';
  const [noticeAcked, setNoticeAcked] = useState(true);
  // Closed by the visitor in this page view, whatever storage allowed.
  const [closed, setClosed] = useState(false);

  useEffect(() => { setNoticeAcked(safeGet(NOTICE_ACK_KEY) === '1'); }, []);

  // Footer link → reopen the choice.
  useEffect(() => {
    const open = () => { setClosed(false); reset(); };
    window.addEventListener(PRIVACY_SETTINGS_EVENT, open);
    return () => window.removeEventListener(PRIVACY_SETTINGS_EVENT, open);
  }, [reset]);

  const mode: 'choice' | 'notice' | null =
    !pixelEnabled() || !ready || closed ? null
      : status === 'unset' ? 'choice'
      : status === 'accepted' && basis === 'implied' && !noticeAcked ? 'notice'
      : null;

  // Floating buttons (the AI assistant) read this to sit above the bar instead of under it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--consent-bar-h', mode ? '3.5rem' : '0px');
    return () => { root.style.setProperty('--consent-bar-h', '0px'); };
  }, [mode]);

  if (!mode) return null;

  const bar = 'fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur';
  const row = 'mx-auto flex max-w-4xl items-center gap-2';
  const text = 'min-w-0 flex-1 text-xs leading-snug text-muted-foreground';
  const btn = 'inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';
  const more = (
    <Link href={`/${locale}/privacy`} className="font-semibold text-gold underline-offset-2 hover:underline">
      {isAr ? 'التفاصيل' : 'Details'}
    </Link>
  );

  // Prior-consent region: nothing measures until a click. Asked once.
  if (mode === 'choice') {
    return (
      <div role="dialog" aria-live="polite" aria-label={isAr ? 'إعداد الخصوصية' : 'Privacy preferences'} className={bar}>
        <div className={row}>
          <p className={text}>
            {isAr ? 'نقيس أداء إعلاناتنا بعد موافقتك فقط.' : 'We measure our ads only with your consent.'} {more}
          </p>
          <button type="button" onClick={() => { reject(); setClosed(true); }}
            className={`${btn} border border-border text-foreground hover:bg-muted`}>
            {isAr ? 'رفض' : 'Reject'}
          </button>
          <button type="button" onClick={() => { accept(); setClosed(true); }}
            className={`${btn} bg-gold text-white hover:opacity-90`}>
            {isAr ? 'موافقة' : 'Accept'}
          </button>
        </div>
      </div>
    );
  }

  // Legitimate interest: a one-time notice with an opt-out.
  {
    const ack = () => { safeSet(NOTICE_ACK_KEY, '1'); setNoticeAcked(true); setClosed(true); };
    return (
      <div role="region" aria-live="polite" aria-label={isAr ? 'إشعار القياس' : 'Measurement notice'} className={bar}>
        <div className={row}>
          <p className={text}>
            {isAr ? 'نقيس أداء إعلاناتنا دون إرسال بياناتك الشخصية.' : 'We measure our ads without sending your personal data.'} {more}
          </p>
          <button type="button" onClick={() => { reject(); ack(); }}
            className={`${btn} border border-border text-foreground hover:bg-muted`}>
            {isAr ? 'إيقاف' : 'Turn off'}
          </button>
          <button type="button" onClick={ack} aria-label={isAr ? 'إغلاق' : 'Close'}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }
}
