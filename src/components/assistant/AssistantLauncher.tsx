"use client";

// Floating launcher for the AI sales assistant + proactive greeting bubble.
// Navigates to the full assistant page (TSH rule: no modals/overlay sheets).
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { ASSISTANT_COPY, assistantLocale } from "./i18n";

const SEEN_KEY = "tsh_assistant_bubble_seen_v1";

export function AssistantLauncher({ locale }: { locale: string }) {
  const L = assistantLocale(locale);
  const t = ASSISTANT_COPY[L];
  const pathname = usePathname();
  const [bubble, setBubble] = useState(false);
  const onAssistant = /\/assistant(?:\/|$)/.test(pathname || "");

  useEffect(() => {
    if (onAssistant) return;
    if (typeof window === "undefined" || sessionStorage.getItem(SEEN_KEY)) return;
    const id = window.setTimeout(() => setBubble(true), 8000);
    return () => window.clearTimeout(id);
  }, [onAssistant]);

  const dismiss = () => { setBubble(false); try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {} };
  if (onAssistant) return null;
  const href = `/${locale}/assistant`;

  return (
    <>
      {bubble ? (
        <div className="fixed bottom-[8.5rem] end-4 z-40 w-[min(320px,calc(100vw-2rem))] rounded-2xl border bg-card p-3 shadow-2xl md:bottom-24 md:end-6" role="status">
          <button onClick={dismiss} aria-label={t.bubbleClose} className="absolute top-2 end-2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
          <div className="flex gap-2.5 pe-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
            <div className="text-[13px] leading-relaxed">{t.bubble}</div>
          </div>
          <Link href={href} onClick={dismiss} className="mt-2.5 block rounded-xl bg-primary py-2 text-center text-[13px] font-medium text-primary-foreground">{t.bubbleCta}</Link>
        </div>
      ) : null}
      <Link href={href} aria-label={t.launcher} title={t.launcher} onClick={dismiss}
        className="fixed bottom-[4.75rem] end-4 z-40 flex h-12 items-center gap-2 rounded-2xl bg-primary px-3 text-primary-foreground shadow-lg shadow-black/25 transition-transform native-press hover:scale-105 md:bottom-6 md:end-6 md:h-12">
        <Sparkles className="h-5 w-5" />
        <span className="hidden text-sm font-medium md:inline">{t.launcher}</span>
        <span className="absolute -top-1 -end-1 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400" />
      </Link>
    </>
  );
}
