"use client";

// قائمة زيارات الجرد والمطابقة الخاصة بالعميل — كل زيارة لها تقرير قابل للطباعة والتنزيل.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardCheck, FileText, Inbox, Printer } from "lucide-react";

export interface CustodyVisitRow {
  id: number;
  name: string;
  state: string;
  rep_name: string;
  created_at: string | null;
  sealed_at: string | null;
  closed_at: string | null;
  line_count: number;
  sold_qty: number;
  report_count: number;
}

const stateColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  needs_action: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : d.toLocaleDateString("en-GB");
}

export function CustodyVisitsList({ visits }: { visits: CustodyVisitRow[] }) {
  const t = useTranslations("consignments");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/consignments">
          <Button variant="ghost" size="icon" className="rtl:rotate-180"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">{t("visitsTitle")}</h1>
          <p className="text-xs text-muted-foreground">{t("visitsDesc")}</p>
        </div>
      </div>

      {visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-14 text-center">
          <Inbox className="mb-4 h-14 w-14 text-muted-foreground/30" />
          <h2 className="text-base font-semibold text-muted-foreground">{t("visitsEmpty")}</h2>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const stateKey = ("visitState_" + v.state) as Parameters<typeof t>[0];
            return (
              <Card key={v.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>{v.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge className={`px-1.5 py-0 text-[10px] ${stateColors[v.state] || stateColors.submitted}`}>{t(stateKey)}</Badge>
                          <span>{dateLabel(v.sealed_at || v.created_at)}</span>
                          {v.rep_name && <span>· {v.rep_name}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-muted/50 p-2"><b className="block text-base">{v.line_count.toLocaleString("en-US")}</b>{t("lineCount")}</div>
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"><b className="block text-base">{v.sold_qty.toLocaleString("en-US")}</b>{t("visitSoldQty")}</div>
                    <div className="rounded-xl bg-muted/50 p-2"><b className="block text-base">{v.report_count.toLocaleString("en-US")}</b>{t("visitInvoices")}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Link href={`/consignments/visits/${v.id}`} className="contents">
                      <Button size="sm" className="w-full"><FileText className="h-4 w-4 me-1" /> {t("visitOpenReport")}</Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/consignments/visits/${v.id}/document/print`, "_blank")}>
                      <Printer className="h-4 w-4 me-1" /> {t("printDocument")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/consignments/visits/${v.id}/document`, "_blank")}>
                      <FileText className="h-4 w-4 me-1" /> PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
