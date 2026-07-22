"use client";

// Aggregate dashboard: monthly goal bar + streak + 3 financial KPI tiles.
// Violet = consignment identity across the whole TSH system.
import { useTranslations } from "next-intl";
import { Target, Flame, PackageCheck, Wallet, Boxes } from "lucide-react";

export interface ConsignmentSummaryData {
  totals: Array<{ currency_id: number; value_held: number; charged: number; remaining: number; units_remaining: number }>;
  pending: Array<{ currency_id: number; pending_value: number; pending_units: number }>;
  monthly: { units: number; goal: number };
  streak_weeks: number;
}

const fmt = (v: number, cur: number) => cur === 1
  ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : v.toLocaleString("en-US");

export function ConsignmentSummary({ summary }: { summary: ConsignmentSummaryData | null }) {
  const t = useTranslations("consignments");
  if (!summary || !summary.totals.length) return null;
  const { monthly, streak_weeks } = summary;
  const pct = monthly.goal > 0 ? Math.min(100, Math.round((monthly.units / monthly.goal) * 100)) : 0;
  const remainingToGoal = Math.max(0, monthly.goal - monthly.units);

  return (
    <div className="space-y-3">
      {/* Monthly goal */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold">
            <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" /> {t("goalTitle")}
          </h2>
          {streak_weeks > 1 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <Flame className="h-3.5 w-3.5" /> {t("streakWeeks", { n: streak_weeks.toLocaleString("en-US") })}
            </span>
          )}
        </div>
        <div className="mt-2.5 h-3 overflow-hidden rounded-full border bg-muted">
          <div className="h-full rounded-full bg-gradient-to-l from-violet-600 to-violet-400 transition-all duration-700"
            style={{ width: String(pct) + "%" }} />
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {monthly.units >= monthly.goal ? (
            <b className="text-violet-600 dark:text-violet-400">{t("goalDone")}</b>
          ) : (
            <>
              {t("goalProgress", { done: monthly.units.toLocaleString("en-US"), target: monthly.goal.toLocaleString("en-US") })}
              {" — "}
              <b className="text-violet-600 dark:text-violet-400">{t("goalRemaining", { n: remainingToGoal.toLocaleString("en-US") })}</b>
            </>
          )}
        </p>
      </div>

      {/* Financial KPIs — one row per currency (multi-currency is rare) */}
      {summary.totals.map(row => {
        const cur = row.currency_id === 1 ? "USD" : "IQD";
        const pend = summary.pending.find(p => p.currency_id === row.currency_id);
        return (
          <div key={row.currency_id} className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border bg-card p-3 text-center shadow-sm">
              <PackageCheck className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="text-[10px] leading-tight text-muted-foreground">{t("valueHeld")}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{fmt(row.value_held, row.currency_id)}</p>
              <p className="text-[9px] text-muted-foreground">{cur}</p>
            </div>
            <div className="rounded-2xl border-2 border-violet-300/70 dark:border-violet-700/60 bg-violet-50/60 dark:bg-violet-950/30 p-3 text-center shadow-sm">
              <Wallet className="mx-auto mb-1 h-4 w-4 text-violet-600 dark:text-violet-400" />
              <p className="text-[10px] leading-tight text-violet-700 dark:text-violet-300">{t("totalCharged")}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">{fmt(row.charged, row.currency_id)}</p>
              <p className="text-[9px] text-violet-600/70 dark:text-violet-400/70">{cur}</p>
              {pend && pend.pending_value > 0 && (
                <p className="mt-0.5 text-[9px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  +{fmt(pend.pending_value, row.currency_id)} {t("underReview")}
                </p>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-3 text-center shadow-sm">
              <Boxes className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="text-[10px] leading-tight text-muted-foreground">{t("remainingValue")}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{fmt(row.remaining, row.currency_id)}</p>
              <p className="text-[9px] text-muted-foreground">{t("unitsAvailable", { n: row.units_remaining.toLocaleString("en-US") })}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
