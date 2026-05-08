"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, ShoppingCart, RotateCcw, MessageSquare, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { ReportSaleForm } from "./report-sale-form";
import { RequestReturnForm } from "./request-return-form";
import { AddNoteForm } from "./add-note-form";

interface Line {
  id: number;
  x_product_id: number;
  product_name: string;
  product_code: string;
  x_qty_delivered: number;
  x_qty_sold: number;
  x_qty_remaining: number;
  x_qty_returned: number;
  x_suggested_retail_price: number;
  pending_reported_qty: number;
  reportable_qty: number;
}

interface SaleReport {
  id: number;
  x_product_id: number;
  x_qty_sold: number;
  x_sell_price: number;
  x_total_amount: number;
  x_state: string;
  x_date_reported: string;
}

interface ConsignmentData {
  id: number;
  name: string;
  state: string;
  date_delivered: string | null;
  currency_id: number;
  lines: Line[];
  sale_reports: SaleReport[];
}

interface Props {
  consignment: ConsignmentData;
  consignmentId: number;
  currencyCode: string;
}

const stateColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  delivered: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  closing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const reportStateIcons: Record<string, typeof Clock> = {
  reported: Clock,
  pending_review: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  failed_needs_review: AlertTriangle,
};

export function ConsignmentDetail({ consignment, consignmentId, currencyCode }: Props) {
  const t = useTranslations("consignments");
  const router = useRouter();
  const [activeForm, setActiveForm] = useState<"sale" | "return" | "note" | null>(null);

  const c = consignment;
  const stateKey = ("state" + c.state.charAt(0).toUpperCase() + c.state.slice(1)) as any;
  const canAct = c.state === "active" || c.state === "delivered";

  const handleSuccess = () => {
    setActiveForm(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/consignments">
          <Button variant="ghost" size="icon" className="rtl:rotate-180">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{c.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-xs ${stateColors[c.state] || stateColors.active}`}>
              {t(stateKey)}
            </Badge>
            {c.date_delivered && (
              <span className="text-xs text-muted-foreground">
                {new Date(c.date_delivered).toLocaleDateString("en-US")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {canAct && (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => setActiveForm("sale")}>
            <ShoppingCart className="h-4 w-4 me-1" /> {t("reportSale")}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setActiveForm("return")}>
            <RotateCcw className="h-4 w-4 me-1" /> {t("requestReturn")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setActiveForm("note")}>
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Forms */}
      {activeForm === "sale" && (
        <ReportSaleForm
          consignmentId={consignmentId}
          lines={c.lines.filter(l => Number(l.reportable_qty) > 0)}
          onSuccess={handleSuccess}
          onCancel={() => setActiveForm(null)}
        />
      )}
      {activeForm === "return" && (
        <RequestReturnForm
          consignmentId={consignmentId}
          lines={c.lines.filter(l => Number(l.x_qty_remaining) > 0)}
          onSuccess={handleSuccess}
          onCancel={() => setActiveForm(null)}
        />
      )}
      {activeForm === "note" && (
        <AddNoteForm
          consignmentId={consignmentId}
          onSuccess={handleSuccess}
          onCancel={() => setActiveForm(null)}
        />
      )}

      {/* Product lines */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t("products")} ({c.lines.length.toLocaleString("en-US")})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {c.lines.map((line) => (
              <div key={line.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{line.product_name}</p>
                    {line.product_code && (
                      <p className="text-xs text-muted-foreground">{line.product_code}</p>
                    )}
                  </div>
                  <Package className="h-4 w-4 text-muted-foreground/50 ms-2 mt-0.5 flex-shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] text-muted-foreground">{t("qtyDelivered")}</p>
                    <p className="font-bold text-sm">{Number(line.x_qty_delivered).toLocaleString("en-US")}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] text-muted-foreground">{t("qtySold")}</p>
                    <p className="font-bold text-sm">{Number(line.x_qty_sold).toLocaleString("en-US")}</p>
                  </div>
                  <div className="rounded-md bg-primary/5 p-2 border border-primary/20">
                    <p className="text-[10px] text-primary">{t("qtyRemaining")}</p>
                    <p className="font-bold text-sm text-primary">{Number(line.x_qty_remaining).toLocaleString("en-US")}</p>
                  </div>
                </div>
                {(Number(line.pending_reported_qty) > 0 || Number(line.x_qty_returned) > 0) && (
                  <div className="flex gap-3 mt-2 text-xs">
                    {Number(line.pending_reported_qty) > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {t("qtyPending")}: {Number(line.pending_reported_qty).toLocaleString("en-US")}
                      </span>
                    )}
                    {Number(line.x_qty_returned) > 0 && (
                      <span className="text-muted-foreground">
                        {t("qtyReturned")}: {Number(line.x_qty_returned).toLocaleString("en-US")}
                      </span>
                    )}
                  </div>
                )}
                {Number(line.reportable_qty) > 0 && canAct && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    {t("qtyReportable")}: {Number(line.reportable_qty).toLocaleString("en-US")}
                  </p>
                )}
                {line.x_suggested_retail_price > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("suggestedPrice")}: {Number(line.x_suggested_retail_price).toLocaleString("en-US")} {currencyCode}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sale reports */}
      {c.sale_reports && c.sale_reports.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("saleReports")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {c.sale_reports.map((r) => {
                const stKey = r.x_state === "pending_review" ? "reportStatePending"
                  : r.x_state === "failed_needs_review" ? "reportStateFailed"
                  : ("reportState" + r.x_state.charAt(0).toUpperCase() + r.x_state.slice(1));
                const Icon = reportStateIcons[r.x_state] || Clock;
                return (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {Number(r.x_qty_sold).toLocaleString("en-US")} {t("reportQty")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.x_date_reported ? new Date(r.x_date_reported).toLocaleDateString("en-US") : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t(stKey as any)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {c.sale_reports && c.sale_reports.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">{t("noReports")}</p>
      )}
    </div>
  );
}
