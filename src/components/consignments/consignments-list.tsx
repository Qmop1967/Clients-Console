"use client";

// Consignment dashboard — إدارة العهدة المخزنية
// Order matters: identity header → Battery Finder (the daily tool, always first)
// → goal + financial KPIs → consignment cards → collapsible "how it works" guide.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ChevronRight, ChevronDown, Inbox, BookOpen } from "lucide-react";
import { BatteryFinder } from "./battery-finder";
import { ConsignmentSummary, type ConsignmentSummaryData } from "./consignment-summary";

interface Consignment {
  id: number;
  x_name: string;
  x_state: string;
  x_date_delivered: string | null;
  line_count: number;
  total_remaining: number;
  total_sold: number;
}

interface Props {
  consignments: Consignment[];
  total: number;
  summary?: ConsignmentSummaryData | null;
}

const stateColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  delivered: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  closing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function Guide() {
  const t = useTranslations("consignments");
  const [open, setOpen] = useState(false);
  const steps = [t("guideStep1"), t("guideStep2"), t("guideStep3"), t("guideStep4")];
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start">
        <span className="flex items-center gap-2 text-[13px] font-bold">
          <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" /> {t("guideTitle")}
        </span>
        <ChevronDown className={"h-4 w-4 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t px-4 py-3.5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                {(i + 1).toLocaleString("en-US")}
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConsignmentsList({ consignments, total, summary }: Props) {
  const t = useTranslations("consignments");
  const firstActive = consignments.find(c => c.x_state === "active" || c.x_state === "delivered");

  return (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="rounded-2xl bg-gradient-to-l from-violet-700 to-violet-500 dark:from-violet-900 dark:to-violet-700 p-4 text-white shadow-md">
        <h1 className="text-lg font-extrabold">{t("title")}</h1>
        <p className="mt-0.5 text-[12px] text-violet-100">{t("tagline")}</p>
      </div>

      {/* Battery Finder — always first, even with zero consignments */}
      <BatteryFinder firstConsignmentId={firstActive?.id || null} />

      {/* Goal + KPIs */}
      <ConsignmentSummary summary={summary || null} />

      {/* Consignment cards */}
      {(!consignments || consignments.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-14 text-center">
          <Inbox className="mb-4 h-14 w-14 text-muted-foreground/30" />
          <h2 className="text-base font-semibold text-muted-foreground">{t("empty")}</h2>
          <p className="mt-1 text-sm text-muted-foreground/70">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-bold">{t("myBatteries")}</h2>
            <Badge variant="secondary" className="text-xs">{total.toLocaleString("en-US")}</Badge>
          </div>
          {consignments.map((c) => {
            const stateKey = ("state" + c.x_state.charAt(0).toUpperCase() + c.x_state.slice(1)) as Parameters<typeof t>[0];
            return (
              <Link key={c.id} href={`/consignments/${c.id}`}>
                <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                          <Package className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>{c.x_name}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge className={`px-1.5 py-0 text-[10px] ${stateColors[c.x_state] || stateColors.active}`}>
                              {t(stateKey)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {c.line_count.toLocaleString("en-US")} {t("lineCount")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <p className="text-xs text-muted-foreground">{t("qtyRemaining")}</p>
                          <p className="text-sm font-bold">{Number(c.total_remaining).toLocaleString("en-US")}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                      </div>
                    </div>
                    {c.x_date_delivered && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("deliveredDate")}: <span dir="ltr">{new Date(c.x_date_delivered).toLocaleDateString("en-US")}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* How it works */}
      <Guide />
    </div>
  );
}
