"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  clearMutationKey,
  getOrCreateMutationKey,
  isConfirmedMutationFailure,
  mutationOperationStorageKey,
} from "@/lib/consignments/operation-key";
import { consignmentReturnableQty } from "@/lib/consignments/return-availability";
import {
  normalizeReturnRequestAcknowledgement,
  returnRequestAcknowledgementMatches,
} from "@/lib/consignments/mutation-acknowledgements";

interface Line {
  id: number;
  x_product_id: number;
  product_name: string;
  product_code: string;
  x_qty_remaining: number;
  reportable_qty?: number;
  returnable_qty?: number;
  pending_reported_qty?: number;
  pending_return_qty?: number;
}

const ERROR_KEYS: Record<string, string> = {
  EXCEEDS_RETURNABLE: "errorExceedsQty",
  EXCEEDS_RETURNABLE_QTY: "errorExceedsQty",
  EXCEEDS_REMAINING: "errorExceedsQty",
  RETURN_ALREADY_PENDING: "errorExceedsQty",
  PENDING_RETURN_EXISTS: "errorExceedsQty",
  INVALID_QTY: "errorInvalidQty",
  NOT_ACTIVE: "errorNotActive",
  LINE_NOT_FOUND: "errorLineNotFound",
  PRODUCT_MISMATCH: "errorLineNotFound",
  NOT_FOUND: "errorNotFound",
};

interface Props {
  consignmentId: number;
  lines: Line[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function RequestReturnForm({ consignmentId, lines, onSuccess, onCancel }: Props) {
  const t = useTranslations("consignments");
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedLine = lines.find(l => String(l.id) === selectedLineId);
  const maxQty = selectedLine ? consignmentReturnableQty(selectedLine) : 0;
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

    const operationStorageKey = mutationOperationStorageKey("request-return", {
      consignmentId,
      consignmentLineId: selectedLine.id,
      productId: selectedLine.x_product_id,
      qtyReturning: qtyNum,
      notes: reason.trim(),
    });

    try {
      const idempotencyKey = getOrCreateMutationKey(window.localStorage, operationStorageKey);
      const res = await fetch(`/api/consignments/${consignmentId}/request-return`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Idempotency-Key": idempotencyKey,
        },
        cache: "no-store",
        body: JSON.stringify({
          lines: [{
            consignment_line_id: selectedLine.id,
            product_id: selectedLine.x_product_id,
            qty_returning: qtyNum,
          }],
          notes: reason,
          idempotency_key: idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isConfirmedMutationFailure(res.status, data)) {
          clearMutationKey(window.localStorage, operationStorageKey);
        }
        const code = String(data?.code || data?.error?.code || "").trim().toUpperCase();
        setError(t((ERROR_KEYS[code] || "errorGeneric") as Parameters<typeof t>[0]));
        setConfirming(false);
        return;
      }
      const acknowledgement = normalizeReturnRequestAcknowledgement(data);
      if (!returnRequestAcknowledgementMatches(acknowledgement, {
        consignmentId,
        idempotencyKey,
        lines: [{
          consignmentLineId: selectedLine.id,
          productId: selectedLine.x_product_id,
          qtyReturning: qtyNum,
        }],
      })) {
        // Unknown/misdirected 2xx responses remain retryable with the same key.
        setError(t("errorGeneric"));
        setConfirming(false);
        return;
      }
      clearMutationKey(window.localStorage, operationStorageKey);
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
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("requestReturnSuccess")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t("requestReturnTitle")}</CardTitle>
        <CardDescription className="text-xs">{t("requestReturnDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={selectedLineId} onValueChange={(v) => { setSelectedLineId(v); setQty(""); setConfirming(false); }}>
          <SelectTrigger>
            <SelectValue placeholder={t("selectProduct")} />
          </SelectTrigger>
          <SelectContent>
            {lines.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.product_name} ({t("qtyRemaining")}: {Number(l.x_qty_remaining).toLocaleString("en-US")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedLine && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">{t("returnQty")}</label>
                <span className="text-xs text-muted-foreground">{t("maxQty")}: {maxQty.toLocaleString("en-US")}</span>
              </div>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => { setQty(e.target.value); setConfirming(false); }}
              />
            </div>

            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("returnReasonPlaceholder")}
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
