"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, RotateCcw, MessageSquare, Clock, CheckCircle2, XCircle, AlertTriangle, Wallet, FileText, Printer, PackageCheck, Boxes } from "lucide-react";
import { ReportSaleForm } from "./report-sale-form";
import { RequestReturnForm } from "./request-return-form";
import { AddNoteForm } from "./add-note-form";
import { ProductImageSmall } from "@/components/products";
import { getOdooImageUrl } from "@/lib/odoo/client";

interface Line {
  id: number;
  x_product_id: number;
  product_name: string;
  product_code: string;
  x_qty_delivered: number;
  x_qty_sold: number;
  x_qty_remaining: number;
  x_qty_returned: number;
  x_qty_invoiced: number;
  x_suggested_retail_price: number;
  x_invoice_unit_price: number;
  pending_reported_qty: number;
  reportable_qty: number;
  image_version?: number;
}

interface SaleReport {
  id: number;
  x_product_id: number;
  x_qty_sold: number;
  x_sell_price: number;
  x_total_amount: number;
  x_state: string;
  x_date_reported: string;
  x_invoice_id: number | null;
  invoice_name: string | null;
  invoice_state: string | null;
  invoice_amount: number | null;
  amount_due: number;
}

interface Financials {
  delivered_value: number;
  charged_value: number;
  remaining_value: number;
}

interface ConsignmentData {
  id: number;
  name: string;
  state: string;
  date_created: string | null;
  date_delivered: string | null;
  currency_id: number;
  financials?: Financials;
  lines: Line[];
  sale_reports: SaleReport[];
  topups?: Array<{ id: number; x_name: string; x_total_qty: number; x_date_delivered: string | null; lines: Array<{ product_name: string; qty: number }> }>;
}

interface Props {
  consignment: ConsignmentData;
  consignmentId: number;
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
  invoiced: CheckCircle2,
  rejected: XCircle,
  failed_needs_review: AlertTriangle,
};

export function ConsignmentDetail({ consignment, consignmentId }: Props) {
  const t = useTranslations("consignments");
  const router = useRouter();
  const [activeForm, setActiveForm] = useState<"sale" | "return" | "note" | null>(null);
  const [saleLineId, setSaleLineId] = useState<number | null>(null);

  const c = consignment;
  // Currency ALWAYS derives from the consignment record itself (87=IQD design default),
  // NEVER from the customer session — a USD customer can hold an IQD consignment.
  const cur = c.currency_id === 1 ? "USD" : "IQD";
  const num = (v: any) => Number(v || 0);
  const fmt = (v: any) => c.currency_id === 1
    ? Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(v || 0).toLocaleString("en-US");
  const stateKey = ("state" + c.state.charAt(0).toUpperCase() + c.state.slice(1)) as any;
  const canAct = c.state === "active" || c.state === "delivered";

  const fin: Financials = c.financials || {
    delivered_value: c.lines.reduce((a, l) => a + num(l.x_qty_delivered) * num(l.x_invoice_unit_price), 0),
    charged_value: c.lines.reduce((a, l) => a + num(l.x_qty_invoiced) * num(l.x_invoice_unit_price), 0),
    remaining_value: c.lines.reduce((a, l) => a + num(l.x_qty_remaining) * num(l.x_invoice_unit_price), 0),
  };

  const pendingValue = c.lines.reduce((a, l) => a + num(l.pending_reported_qty) * num(l.x_invoice_unit_price), 0);

  const openSaleForm = (lineId: number | null) => {
    setSaleLineId(lineId);
    setActiveForm("sale");
    setTimeout(() => {
      document.getElementById("csgn-forms")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const handleSuccess = () => {
    setActiveForm(null);
    setSaleLineId(null);
    router.refresh();
  };

  const events: Array<{ icon: typeof Clock; title: string; date: string | null; amount?: number; invoice?: string | null; tone: string }> = [];
  if (c.date_created) events.push({ icon: Boxes, title: t("eventCreated"), date: c.date_created, tone: "text-muted-foreground" });
  if (c.date_delivered) events.push({ icon: PackageCheck, title: t("eventDelivered"), date: c.date_delivered, tone: "text-blue-600 dark:text-blue-400" });
  [...c.sale_reports]
    .filter((r) => r.x_state !== "rejected")
    .sort((a, b) => new Date(a.x_date_reported).getTime() - new Date(b.x_date_reported).getTime())
    .forEach((r) => {
      const invoiced = r.x_state === "invoiced" || r.invoice_state === "posted";
      events.push({
        icon: invoiced ? Wallet : Clock,
        title: t("eventSold") + " " + fmt(r.x_qty_sold),
        date: r.x_date_reported,
        amount: num(r.amount_due),
        invoice: invoiced ? r.invoice_name : null,
        tone: invoiced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      });
    });
  (c.topups || []).forEach((tp) => {
    const q = (tp.lines || []).reduce((a, l) => a + Number(l.qty || 0), 0) || Number(tp.x_total_qty || 0);
    events.push({
      icon: PackageCheck,
      title: t("eventReplenished") + " " + fmt(q),
      date: tp.x_date_delivered,
      tone: "text-indigo-600 dark:text-indigo-400",
    });
  });
  events.sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));

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
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 whitespace-nowrap"
          onClick={() => window.open(`/api/consignments/${consignmentId}/document/print`, "_blank")}
        >
          <Printer className="h-4 w-4 me-1" /> {t("printDocument")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 whitespace-nowrap"
          onClick={() => window.open(`/api/consignments/${consignmentId}/document`, "_blank")}
        >
          <FileText className="h-4 w-4 me-1" /> {t("viewDocument")}
        </Button>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center">
          <PackageCheck className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground leading-tight">{t("valueHeld")}</p>
          <p className="text-sm font-bold mt-0.5 tabular-nums">{fmt(fin.delivered_value)}</p>
          <p className="text-[9px] text-muted-foreground">{cur}</p>
        </div>
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-center">
          <Wallet className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-primary leading-tight">{t("totalCharged")}</p>
          <p className="text-sm font-bold mt-0.5 text-primary tabular-nums">{fmt(fin.charged_value)}</p>
          <p className="text-[9px] text-primary/70">{cur}</p>
          {pendingValue > 0 && (
            <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">+{fmt(pendingValue)} {t("underReview")}</p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <Boxes className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground leading-tight">{t("remainingValue")}</p>
          <p className="text-sm font-bold mt-0.5 tabular-nums">{fmt(fin.remaining_value)}</p>
          <p className="text-[9px] text-muted-foreground">{cur}</p>
        </div>
      </div>

      {/* Action buttons */}
      {canAct && (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => openSaleForm(null)}>
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
      <div id="csgn-forms" className="scroll-mt-4 empty:hidden space-y-4">
      {activeForm === "sale" && (
        <ReportSaleForm
          consignmentId={consignmentId}
          lines={c.lines.filter(l => Number(l.reportable_qty) > 0)}
          currency={cur}
          fmt={fmt}
          initialLineId={saleLineId}
          onSuccess={handleSuccess}
          onCancel={() => { setActiveForm(null); setSaleLineId(null); }}
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
      </div>

      {/* Product lines */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t("products")} ({c.lines.length.toLocaleString("en-US")})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {c.lines.map((line) => (
              <div key={line.id} className="p-4">
                <div className="flex items-start gap-3">
                  <ProductImageSmall
                    src={line.image_version ? getOdooImageUrl(line.x_product_id, "128x128", line.image_version) : null}
                    alt={line.product_name}
                    className="h-14 w-14 rounded-lg flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{line.product_name}</p>
                    {line.product_code && (
                      <p className="text-xs text-muted-foreground">{line.product_code}</p>
                    )}
                  </div>
                </div>

                {/* Price row: your cost + suggested retail */}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                    <span className="text-muted-foreground">{t("yourCost")}:</span>
                    <b className="tabular-nums">{fmt(line.x_invoice_unit_price)}</b>
                    <span className="text-muted-foreground">{cur}</span>
                  </span>
                  {line.x_suggested_retail_price > 0 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span>{t("suggestedPrice")}:</span>
                      <b className="tabular-nums text-foreground">{fmt(line.x_suggested_retail_price)}</b>
                    </span>
                  )}
                </div>

                {/* Quantities */}
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
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {t("qtyReportable")}: {Number(line.reportable_qty).toLocaleString("en-US")}
                    </p>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs shrink-0" onClick={() => openSaleForm(line.id)}>
                      <ShoppingCart className="h-3.5 w-3.5 me-1" /> {t("reportSale")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sales & invoices */}
      {c.sale_reports && c.sale_reports.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4" /> {t("saleReports")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {c.sale_reports.map((r) => {
                const invoiced = r.x_state === "invoiced" || r.invoice_state === "posted";
                const rejected = r.x_state === "rejected";
                const stKey = r.x_state === "pending_review" ? "reportStatePending"
                  : r.x_state === "failed_needs_review" ? "reportStateFailed"
                  : ("reportState" + r.x_state.charAt(0).toUpperCase() + r.x_state.slice(1));
                const Icon = reportStateIcons[r.x_state] || Clock;
                return (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {Number(r.x_qty_sold).toLocaleString("en-US")} {t("reportQty")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.x_date_reported ? new Date(r.x_date_reported).toLocaleDateString("en-US") : ""}
                        </p>
                      </div>
                      {invoiced ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] shrink-0">
                          <CheckCircle2 className="h-3 w-3 me-1" /> {t("addedToBalance")}
                        </Badge>
                      ) : (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{t(stKey as any)}</span>
                        </span>
                      )}
                    </div>

                    {!rejected && (
                      <div className="mt-2.5 rounded-lg bg-muted/40 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t("amountDue")}</span>
                          <span className={`text-sm font-bold tabular-nums ${invoiced ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                            {fmt(r.amount_due)} <span className="text-[10px] font-normal text-muted-foreground">{cur}</span>
                          </span>
                        </div>
                        {invoiced && r.invoice_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{t("invoiceNo")}</span>
                            <span className="text-xs font-mono text-foreground">{r.invoice_name}</span>
                          </div>
                        )}
                        {Number(r.x_total_amount) > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">{t("retailValue")}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">{fmt(r.x_total_amount)} {cur}</span>
                          </div>
                        )}
                      </div>
                    )}
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

      {/* Timeline */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Clock className="h-4 w-4" /> {t("timeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5"><Icon className={`h-4 w-4 ${ev.tone}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm">{ev.title}</p>
                        {ev.amount ? (<span className={`text-xs font-bold tabular-nums ${ev.tone}`}>{fmt(ev.amount)} {cur}</span>) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-muted-foreground">{ev.date ? new Date(ev.date).toLocaleDateString("en-US") : ""}</p>
                        {ev.invoice && <span className="text-[11px] font-mono text-muted-foreground">· {ev.invoice}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
