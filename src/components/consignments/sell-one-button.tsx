"use client";

// One-tap sale: optimistic click → 5s undo window → POST report-sale (qty=1).
// The POST only fires AFTER the undo window closes, so "undo" never hits the server.
//
// Durability: the pending attempt (line, qty, idempotency key, started-at) is
// persisted in localStorage the moment the countdown starts. If the tab is
// closed/reloaded before the POST was acknowledged, the attempt is replayed on
// mount with the SAME idempotency key — the remaining undo window is honoured
// first, so «تراجع» keeps working after a reload.
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { consignmentErrorKey } from "@/lib/consignments/error-keys";

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

const UNDO_SECONDS = 5;

interface PendingSaleOneRecord {
  v: 1;
  consignmentId: number;
  lineId: number;
  productId: number;
  effectiveSellPrice: number;
  currencyId: number;
  qty: 1;
  idempotencyKey: string;
  operationStorageKey: string;
  startedAt: number;
}

function pendingStorageKey(consignmentId: number, lineId: number): string {
  return `tsh:consignment-sale-one-pending:v1:${consignmentId}:${lineId}`;
}

function readPending(consignmentId: number, lineId: number): PendingSaleOneRecord | null {
  try {
    const raw = window.localStorage.getItem(pendingStorageKey(consignmentId, lineId));
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<PendingSaleOneRecord>;
    if (
      rec?.v !== 1 ||
      rec.consignmentId !== consignmentId ||
      rec.lineId !== lineId ||
      rec.qty !== 1 ||
      typeof rec.idempotencyKey !== "string" || rec.idempotencyKey.length < 16 ||
      typeof rec.operationStorageKey !== "string" ||
      typeof rec.startedAt !== "number"
    ) {
      window.localStorage.removeItem(pendingStorageKey(consignmentId, lineId));
      return null;
    }
    return rec as PendingSaleOneRecord;
  } catch {
    return null;
  }
}

function writePending(rec: PendingSaleOneRecord): void {
  try {
    window.localStorage.setItem(pendingStorageKey(rec.consignmentId, rec.lineId), JSON.stringify(rec));
  } catch { /* storage unavailable — attempt continues in-memory only */ }
}

function clearPending(consignmentId: number, lineId: number): void {
  try { window.localStorage.removeItem(pendingStorageKey(consignmentId, lineId)); } catch { /* noop */ }
}

export function SellOneButton({
  consignmentId, lineId, productId, effectiveSellPrice, currencyId, labels, className, disabled,
  hideWhenDisabled, showToast, onOptimistic, onUndo, onCommitted,
}: Props) {
  const t = useTranslations("consignments");
  const [phase, setPhase] = useState<"idle" | "countdown" | "posting" | "pending">("idle");
  const [count, setCount] = useState(UNDO_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const attemptRef = useRef<SaleOneAttempt | null>(null);
  const replayedRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const errorMessage = (payload: unknown): string => {
    const key = consignmentErrorKey(payload, "");
    return key ? t(key as Parameters<typeof t>[0]) : labels.error;
  };

  const runCountdown = (seconds: number) => {
    let c = Math.max(1, Math.ceil(seconds));
    setCount(c);
    setPhase("countdown");
    if (timerRef.current) clearInterval(timerRef.current);
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

  const start = () => {
    if (phase !== "idle" || disabled) return;
    let attempt: SaleOneAttempt;
    let idem: string;
    try {
      attempt = createSaleOneAttempt({
        consignmentId,
        lineId,
        productId,
        effectiveSellPrice,
        currencyId,
      });
      idem = getOrCreateMutationKey(window.localStorage, attempt.operationStorageKey);
    } catch {
      showToast(labels.error);
      return;
    }
    attemptRef.current = attempt;
    cancelledRef.current = false;
    writePending({
      v: 1,
      consignmentId: attempt.consignmentId,
      lineId: attempt.lineId,
      productId: attempt.productId,
      effectiveSellPrice: attempt.effectiveSellPrice,
      currencyId: attempt.currencyId,
      qty: 1,
      idempotencyKey: idem,
      operationStorageKey: attempt.operationStorageKey,
      startedAt: Date.now(),
    });
    fireConfetti();
    onOptimistic?.(attempt);
    runCountdown(UNDO_SECONDS);
  };

  const undo = () => {
    const attempt = attemptRef.current;
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    attemptRef.current = null;
    // The POST never fired, so the idempotency key and pending record are moot.
    if (attempt) clearMutationKey(window.localStorage, attempt.operationStorageKey);
    clearPending(consignmentId, lineId);
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
          clearPending(attempt.consignmentId, attempt.lineId);
          attemptRef.current = null;
          onUndo?.(attempt);
          setPhase("idle");
        } else {
          // The gateway may have committed even when its response was lost.
          // Keep the optimistic quantity, operation key and pending record until retry.
          setPhase("pending");
        }
        showToast(errorMessage(d));
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
      clearPending(attempt.consignmentId, attempt.lineId);
      attemptRef.current = null;
      showToast(labels.sold);
      onCommitted?.(attempt);
    } catch {
      setPhase("pending");
      showToast(labels.error);
      return;
    }
    setPhase("idle");
  };

  // Replay a persisted attempt that was never acknowledged (tab closed/reloaded).
  useEffect(() => {
    if (replayedRef.current) return;
    replayedRef.current = true;
    const rec = readPending(consignmentId, lineId);
    if (!rec) return;
    let attempt: SaleOneAttempt;
    try {
      attempt = createSaleOneAttempt({
        consignmentId: rec.consignmentId,
        lineId: rec.lineId,
        productId: rec.productId,
        effectiveSellPrice: rec.effectiveSellPrice,
        currencyId: rec.currencyId,
      });
    } catch {
      clearPending(consignmentId, lineId);
      return;
    }
    if (attempt.operationStorageKey !== rec.operationStorageKey) {
      // Custody allocation changed since the tap; do not replay a stale price.
      clearMutationKey(window.localStorage, rec.operationStorageKey);
      clearPending(consignmentId, lineId);
      return;
    }
    // Reuse the persisted idempotency key so a replay can never double-sell.
    try {
      getOrCreateMutationKey(window.localStorage, attempt.operationStorageKey, () => rec.idempotencyKey);
    } catch {
      clearPending(consignmentId, lineId);
      return;
    }
    attemptRef.current = attempt;
    cancelledRef.current = false;
    onOptimistic?.(attempt);
    const remaining = UNDO_SECONDS - (Date.now() - rec.startedAt) / 1000;
    if (remaining > 0.5) {
      runCountdown(remaining);
    } else {
      void commit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
