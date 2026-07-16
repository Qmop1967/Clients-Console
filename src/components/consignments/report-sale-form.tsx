"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, Info, Minus, Plus, Wallet } from "lucide-react";
import { ProductImageSmall } from "@/components/products";
import { getOdooImageUrl } from "@/lib/odoo/client";

interface Line {
  id: number;
  x_product_id: number;
  product_name: string;
  product_code: string;
  reportable_qty: number;
  x_qty_remaining: number;
  x_invoice_unit_price: number;
  x_suggested_retail_price: number;
  pending_reported_qty: number;
  image_version?: number;
}

interface Props {
  consignmentId: number;
  lines: Line[];
  currency: string;
  fmt: (v: unknown) => string;
  initialLineId?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// Gateway error codes -> Arabic translation keys (raw English messages must never surface)
const ERROR_KEYS: Record<string, string> = {
  EXCEEDS_REPORTABLE: "errorExceedsQty",
  EXCEEDS_REPORTABLE_QTY: "errorExceedsQty",
  EXCEEDS_REMAINING: "errorExceedsQty",
  INVALID_QTY: "errorInvalidQty",
  BELOW_INVOICE_PRICE: "errorPricing",
  NO_FROZEN_PRICE: "errorPricing",
  NOT_ACTIVE: "errorNotActive",
  LINE_NOT_FOUND: "errorLineNotFound",
  PRODUCT_MISMATCH: "errorLineNotFound",
  NOT_FOUND: "errorNotFound",
};

export function ReportSaleForm({ consignmentId, lines, currency, fmt, initialLineId, onSuccess, onCancel }: Props) {
  const t = useTranslations("consignments");
  const [selectedLineId, setSelectedLineId] = useState<string>(() => {
    if (initialLineId && lines.some(l => l.id === initialLineId)) return String(initialLineId);
    if (lines.length === 1) return String(lines[0].id);
    return "";
  });
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedLine = lines.find(l => String(l.id) === selectedLineId);
  const maxQty = selectedLine ? Number(selectedLine.reportable_qty) : 0;
  const qtyNum = parseInt(qty) || 0;
  const unitPrice = selectedLine ? Number(selectedLine.x_invoice_unit_price) || 0 : 0;
  const chargeTotal = qtyNum > 0 ? qtyNum * unitPrice : 0;
  const isValid = !!selectedLineId && qtyNum > 0 && qtyNum <= maxQty;

  // Sync preselected line coming from a product-card shortcut
  useEffect(() => {
    if (initialLineId && lines.some(l => l.id === initialLineId)) {
      setSelectedLineId(String(initialLineId));
      setQty("1");
      setConfirming(false);
    }
  }, [initialLineId, lines]);

  const pickLine = (v: string) => {
    setSelectedLineId(v);
    setQty("1");
    setConfirming(false);
    setError("");
  };

  const stepQty = (delta: number) => {
    const next = Math.min(Math.max(qtyNum + delta, 1), maxQty || 1);
    setQty(String(next));
    setConfirming(false);
  };

  const handleSubmit = async () => {
    if (!isValid || loading || !selectedLine) return;

    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setError("");

    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch(`/api/consignments/${consignmentId}/report-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consignment_line_id: selectedLine.id,
          product_id: selectedLine.x_product_id,
          qty_sold: qtyNum,
          notes,
          idempotency_key: idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = String(data?.code || "");
        setError(t((ERROR_KEYS[code] || "errorGeneric") as Parameters<typeof t>[0]));
        setConfirming(false);
        return;
      }
      setSuccess(true);
      setTimeout(onSuccess, 1500);
    } catch {
      setError(t("errorGeneric"));
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("reportSaleSuccess")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t("reportSaleTitle")}</CardTitle>
        <CardDescription className="text-xs">{t("reportSaleDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={selectedLineId} onValueChange={pickLine}>
          <SelectTrigger>
            <SelectValue placeholder={t("selectProduct")} />
          </SelectTrigger>
          <SelectContent>
            {lines.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.product_name} ({t("qtyReportable")}: {Number(l.reportable_qty).toLocaleString("en-US")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedLine && (
          <>
            {/* Selected product context */}
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5">
              <ProductImageSmall
                src={selectedLine.image_version ? getOdooImageUrl(selectedLine.x_product_id, "128x128", selectedLine.image_version) : null}
                alt={selectedLine.product_name}
                className="h-12 w-12 rounded-md flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{selectedLine.product_name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                  <span>{t("yourCost")}: <b className="text-foreground tabular-nums">{fmt(unitPrice)}</b> {currency}</span>
                  {Number(selectedLine.x_suggested_retail_price) > 0 && (
                    <span>{t("suggestedPrice")}: <b className="text-foreground tabular-nums">{fmt(selectedLine.x_suggested_retail_price)}</b></span>
                  )}
                </div>
              </div>
            </div>

            {/* Quantity stepper */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">{t("qty")}</label>
                <span className="text-xs text-muted-foreground">{t("maxQty")}: {maxQty.toLocaleString("en-US")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => stepQty(-1)} disabled={qtyNum <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxQty}
                  value={qty}
                  onChange={(e) => { setQty(e.target.value); setConfirming(false); }}
                  placeholder={t("qtyPlaceholder")}
                  className="text-center tabular-nums"
                />
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => stepQty(1)} disabled={qtyNum >= maxQty}>
                  <Plus className="h-4 w-4" />
                </Button>
                {maxQty > 1 && (
                  <Button type="button" variant="secondary" size="sm" className="shrink-0 h-10" onClick={() => { setQty(String(maxQty)); setConfirming(false); }}>
                    {t("sellAll")}
                  </Button>
                )}
              </div>
              {qtyNum > maxQty && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {t("errorExceedsQty")}
                </p>
              )}
            </div>

            {/* What this report will cost — the client sees the exact financial consequence */}
            {isValid && (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-primary" /> {t("willBeCharged")}
                  </span>
                  <span className="text-base font-bold text-primary tabular-nums">
                    {fmt(chargeTotal)} <span className="text-[10px] font-normal">{currency}</span>
                  </span>
                </div>
                <p dir="ltr" className="text-[11px] text-muted-foreground text-left mt-1 tabular-nums">
                  {qtyNum.toLocaleString("en-US")} × {fmt(unitPrice)} {currency}
                </p>
              </div>
            )}

            {Number(selectedLine.pending_reported_qty) > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-400">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{t("reportSaleQtyNote")}</span>
              </div>
            )}

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={2}
              maxLength={500}
            />
          </>
        )}

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 me-1 animate-spin" /> {t("submitting")}</>
            ) : confirming ? (
              t("confirm")
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
