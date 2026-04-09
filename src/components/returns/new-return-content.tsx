"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Package,
  Send,
  ChevronRight,
} from "lucide-react";

interface EligibleOrder {
  id: number;
  name: string;
  date: string;
  amount: number;
  delivered: boolean;
}

interface NewReturnContentProps {
  eligibleOrders: EligibleOrder[];
  currencyCode: string;
}

export function NewReturnContent({
  eligibleOrders,
  currencyCode,
}: NewReturnContentProps) {
  const t = useTranslations("returns");
  const tc = useTranslations("common");

  const [step, setStep] = useState<1 | 2>(1); // 1: select order, 2: fill reason
  const [selectedOrder, setSelectedOrder] = useState<EligibleOrder | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const formatCurrency = (amount: number) => {
    const decimals = currencyCode === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${currencyCode}`
    );
  };

  const handleSelectOrder = (order: EligibleOrder) => {
    setSelectedOrder(order);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedOrder || !reason.trim()) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/returns/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          reason: reason.trim(),
          note: note.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({ success: true, message: t("success") });
      } else {
        setResult({ success: false, message: data.error || t("error") });
      }
    } catch {
      setResult({ success: false, message: t("error") });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setReason("");
      setNote("");
      setResult(null);
    }
  };

  // Success state
  if (result?.success) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-8 text-center">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 w-fit mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">{t("success")}</h2>
            <p className="text-sm text-muted-foreground mb-1">
              {selectedOrder?.name}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {reason}
            </p>
            <Link href="/returns">
              <Button className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("title")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={step === 1 ? "/returns" : "#"} onClick={step === 2 ? handleBack : undefined}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">
            {t("requestReturn")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {step === 1 ? t("selectOrder") : t("reason")}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
      </div>

      {/* Error message */}
      {result && !result.success && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {result.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Select Order */}
      {step === 1 && (
        <div className="space-y-3">
          {eligibleOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <RotateCcw className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">{t("noEligibleOrders")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("eligibleOrders")}</p>
              {eligibleOrders.map((order) => (
                <Card
                  key={order.id}
                  className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all active:scale-[0.99]"
                  onClick={() => handleSelectOrder(order)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{order.name}</p>
                          <p className="text-xs text-muted-foreground">{order.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{formatCurrency(order.amount)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Step 2: Reason & Submit */}
      {step === 2 && selectedOrder && (
        <div className="space-y-4">
          {/* Selected order summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{selectedOrder.name}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.date}</p>
              </div>
              <span className="text-sm font-bold">{formatCurrency(selectedOrder.amount)}</span>
            </CardContent>
          </Card>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("reason")} <span className="text-destructive">*</span>
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              autoFocus
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("note")}</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="w-full gap-2"
            size="lg"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t("submitting")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t("submit")}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
