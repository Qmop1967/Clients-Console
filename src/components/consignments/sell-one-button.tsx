"use client";

// One-tap sale: optimistic click → 5s undo window → POST report-sale (qty=1).
// The POST only fires AFTER the undo window closes, so "undo" never hits the server.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Undo2, Loader2 } from "lucide-react";
import { fireConfetti } from "./confetti";

interface Labels { sell: string; undo: string; sold: string; error: string }

interface Props {
  consignmentId: number;
  lineId: number;
  productId: number;
  labels: Labels;
  className?: string;
  disabled?: boolean;
  showToast: (msg: string) => void;
  onOptimistic?: () => void;
  onUndo?: () => void;
  onCommitted?: () => void;
}

export function SellOneButton({
  consignmentId, lineId, productId, labels, className, disabled,
  showToast, onOptimistic, onUndo, onCommitted,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "countdown" | "posting">("idle");
  const [count, setCount] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const start = () => {
    if (phase !== "idle" || disabled) return;
    cancelledRef.current = false;
    fireConfetti();
    onOptimistic?.();
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
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("idle");
    onUndo?.();
    showToast(labels.undo + " ✓");
  };

  const commit = async () => {
    setPhase("posting");
    try {
      const idem = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
      const res = await fetch(`/api/consignments/${consignmentId}/report-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consignment_line_id: lineId,
          product_id: productId,
          qty_sold: 1,
          idempotency_key: idem,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || labels.error);
      }
      showToast(labels.sold);
      onCommitted?.();
    } catch (e: unknown) {
      onUndo?.();
      showToast(e instanceof Error ? e.message : labels.error);
    } finally {
      setPhase("idle");
    }
  };

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
