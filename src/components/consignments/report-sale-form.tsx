"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react";

interface Line {
  id: number;
  x_product_id: number;
  product_name: string;
  product_code: string;
  reportable_qty: number;
  x_qty_remaining: number;
}

interface Props {
  consignmentId: number;
  lines: Line[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReportSaleForm({ consignmentId, lines, onSuccess, onCancel }: Props) {
  const t = useTranslations("consignments");
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedLine = lines.find(l => String(l.id) === selectedLineId);
  const maxQty = selectedLine ? Number(selectedLine.reportable_qty) : 0;
  const qtyNum = parseInt(qty) || 0;
  const isValid = selectedLineId && qtyNum > 0 && qtyNum <= maxQty;

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
        const code = data?.code || "";
        if (code === "EXCEEDS_REPORTABLE_QTY" || code === "EXCEEDS_REMAINING") {
          setError(t("errorExceedsQty"));
        } else {
          setError(data?.message || t("errorGeneric"));
        }
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
        <Select value={selectedLineId} onValueChange={(v) => { setSelectedLineId(v); setQty(""); setConfirming(false); }}>
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
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">{t("qty")}</label>
                <span className="text-xs text-muted-foreground">{t("maxQty")}: {maxQty.toLocaleString("en-US")}</span>
              </div>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => { setQty(e.target.value); setConfirming(false); }}
                placeholder={t("qtyPlaceholder")}
              />
              {qtyNum > maxQty && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {t("errorExceedsQty")}
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-400">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{t("reportSaleQtyNote")}</span>
            </div>

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
