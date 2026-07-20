import { ListTree } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { toMarketingLocale } from "@/lib/marketing/company";

export type LegalSection = { h: string; p: string[] };

/**
 * Shared layout for /privacy and /terms.
 * RTL note: a single max-w prose column strands the whole left half of a 1280px
 * viewport. The section index lives there instead — it fills the space AND makes
 * a ~2,100px legal page navigable.
 */
function TocList({ sections, label }: { sections: LegalSection[]; label: string }) {
  return (
    <>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ListTree className="size-4 text-gold" aria-hidden />
        {label}
      </p>
      <ol className="space-y-0.5">
        {sections.map((s, i) => (
          <li key={s.h}>
            <a
              href={`#sec-${i + 1}`}
              className="flex min-h-10 items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="w-4 shrink-0 text-xs tabular-nums text-gold" dir="ltr">{i + 1}</span>
              <span>{s.h}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}

export function LegalPage({
  locale, title, updated, sections,
}: { locale: string; title: string; updated: string; sections: LegalSection[] }) {
  const isAr = toMarketingLocale(locale) === "ar";
  const tocLabel = isAr ? "محتويات الصفحة" : "On this page";

  return (
    <MarketingShell locale={locale}>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {isAr ? "آخر تحديث: " : "Last updated: "}<span dir="ltr">{updated}</span>
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_minmax(0,15rem)]">
        <div className="order-2 space-y-9 lg:order-1">
          {sections.map((s, i) => (
            <section key={s.h} id={`sec-${i + 1}`} className="scroll-mt-24">
              <h2 className="font-display text-xl font-bold text-foreground">
                <span className="me-2 text-base font-semibold text-gold" dir="ltr">{i + 1}</span>
                {s.h}
              </h2>
              <div className="mt-3 space-y-2.5">
                {s.p.map((line) => (
                  <p key={line} className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">{line}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="order-1 self-start lg:order-2 lg:sticky lg:top-24">
          <details className="rounded-xl border border-border bg-muted/30 p-4 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <ListTree className="size-4 text-gold" aria-hidden />
              {tocLabel}
            </summary>
            <div className="mt-3">
              <TocList sections={sections} label={tocLabel} />
            </div>
          </details>
          <nav className="hidden rounded-xl border border-border bg-muted/30 p-4 lg:block" aria-label={tocLabel}>
            <TocList sections={sections} label={tocLabel} />
          </nav>
        </div>
      </div>
    </MarketingShell>
  );
}
