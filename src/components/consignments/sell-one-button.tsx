"use client";

// One-tap sale: optimistic click → 5s undo window → POST report-sale (qty=1).
// The POST only fires AFTER the undo window closes, so "undo" never hits the server.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Undo2, Loader2, RotateCcw } from "lucide-react";
import { fireConfetti } from "./confetti";
import {
  clearMutationKey,
  createSaleOneAttempt,
  getOrCreateMutationKey,
  isConfirmedMutationFailure,
  type SaleOneAttempt,
} from "@/lib/consignments/operation-key";
import {
  normalizeSaleReportAcknowledgement,
  saleReportAcknowledgementMatches,
} from "@/lib/consignments/mutation-acknowledgements";

interface Labels { sell: string; undo: string; sold: string; error: string }

interface Props {
  consignmentId: number;
  lineId: number;
  productId: number;
  effectiveSellPrice: number;
  currencyId: number;
  labels: Labels;
  className?: string;
  disabled?: boolean;
  hideWhenDisabled?: boolean;
  showToast: (msg: string) => void;
  onOptimistic?: (attempt: SaleOneAttempt) => void;
  onUndo?: (attempt: SaleOneAttempt) => void;
  onCommitted?: (attempt: SaleOneAttempt) => void;
}

export function SellOneButton({
  consignmentId, lineId, productId, effectiveSellPrice, currencyId, labels, className, disabled,
  hideWhenDisabled, showToast, onOptimistic, onUndo, onCommitted,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "countdown" | "posting" | "pending">("idle");
  const [count, setCount] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const attemptRef = useRef<SaleOneAttempt | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const start = () => {
    if (phase !== "idle" || disabled) return;
    let attempt: SaleOneAttempt;
    try {
      attempt = createSaleOneAttempt({
        consignmentId,
        lineId,
        productId,
        effectiveSellPrice,
        currencyId,
      });
    } catch {
      showToast(labels.error);
      return;
    }
    attemptRef.current = attempt;
    cancelledRef.current = false;
    fireConfetti();
    onOptimistic?.(attempt);
    setCount(5);
    setPhase("countdown");
    let c = 5;
    timerRef.current = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!cancelledRef.current) void commit();
      } else {
        setCount(c);
      }
    }, 1000);
  };

  const undo = () => {
    const attempt = attemptRef.current;
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    attemptRef.current = null;
    setPhase("idle");
    if (attempt) onUndo?.(attempt);
    showToast(labels.undo + " ✓");
  };

  const commit = async () => {
    const attempt = attemptRef.current;
    if (!attempt) {
      setPhase("idle");
      return;
    }
    setPhase("posting");
    try {
      const idem = getOrCreateMutationKey(window.localStorage, attempt.operationStorageKey);
      const res = await fetch(`/api/consignments/${attempt.consignmentId}/report-sale`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Idempotency-Key": idem,
        },
        cache: "no-store",
        body: JSON.stringify({
          consignment_line_id: attempt.lineId,
          product_id: attempt.productId,
          qty_sold: 1,
          idempotency_key: idem,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const d = data && typeof data === "object" ? data : {};
        if (isConfirmedMutationFailure(res.status, d)) {
          clearMutationKey(window.localStorage, attempt.operationStorageKey);
          attemptRef.current = null;
          onUndo?.(attempt);
          setPhase("idle");
        } else {
          // The gateway may have committed even when its response was lost.
          // Keep both the optimistic quantity and operation key until retry.
          setPhase("pending");
        }
        showToast(d?.message || labels.error);
        return;
      }
      const acknowledgement = normalizeSaleReportAcknowledgement(data);
      if (!saleReportAcknowledgementMatches(acknowledgement, {
        consignmentId: attempt.consignmentId,
        consignmentLineId: attempt.lineId,
        productId: attempt.productId,
        qtySold: 1,
        effectiveSellPrice: attempt.effectiveSellPrice,
        currencyId: attempt.currencyId,
        idempotencyKey: idem,
      })) {
        // Keep the optimistic unit and the same operation key until the exact
        // canonical acknowledgement can be recovered.
        setPhase("pending");
        showToast(labels.error);
        return;
      }
      clearMutationKey(window.localStorage, attempt.operationStorageKey);
      attemptRef.current = null;
      showToast(labels.sold);
      onCommitted?.(attempt);
    } catch (e: unknown) {
      setPhase("pending");
      showToast(e instanceof Error ? e.message : labels.error);
      return;
    }
    setPhase("idle");
  };

  // The component stays mounted while disabled so an active countdown/pending
  // attempt survives an optimistic last-unit decrement. Only its idle UI hides.
  if (phase === "idle" && disabled && hideWhenDisabled) return null;

  if (phase === "pending") {
    return (
      <Button size="sm" variant="outline" onClick={() => void commit()}
        className={"border-orange-400 text-orange-700 dark:text-orange-300 " + (className || "")}>
        <RotateCcw className="h-3.5 w-3.5 me-1" /> {labels.sell}
      </Button>
    );
  }

  if (phase === "countdown") {
    return (
      <Button size="sm" variant="outline" onClick={undo}
        className={"border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 " + (className || "")}>
        <Undo2 className="h-3.5 w-3.5 me-1" /> {labels.undo} ({count.toLocaleString("en-US")})
      </Button>
    );
  }
  if (phase === "posting") {
    return (
      <Button size="sm" disabled className={"bg-violet-600 text-white " + (className || "")}>
        <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={start} disabled={disabled}
      className={"bg-violet-600 hover:bg-violet-700 text-white shadow-sm " + (className || "")}>
      <ShoppingCart className="h-3.5 w-3.5 me-1" /> {labels.sell}
    </Button>
  );
}
