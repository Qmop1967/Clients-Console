"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ReturnRequest } from "@/lib/odoo/returns";

interface ReturnsContentProps {
  returns: ReturnRequest[];
  eligibleOrders: Array<{
    id: number;
    name: string;
    date: string;
    amount: number;
    delivered: boolean;
  }>;
  currencyCode: string;
  customerId: string;
}

export function ReturnsContent({
  returns,
  eligibleOrders,
  currencyCode,
  customerId,
}: ReturnsContentProps) {
  const t = useTranslations("returns");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const formatCurrency = (amount: number) => {
    const decimals = currencyCode === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${currencyCode}`
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "requested": return <Clock className="h-4 w-4 text-amber-500" />;
      case "approved": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "rejected": return <XCircle className="h-4 w-4 text-red-500" />;
      case "completed": return <PackageCheck className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "requested": return "secondary";
      case "approved": return "default";
      case "rejected": return "destructive";
      case "completed": return "outline";
      default: return "secondary";
    }
  };

  const handleSubmit = async () => {
    if (!selectedOrder || !reason) return;
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/returns/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: selectedOrder, reason, note }),
      });
      const data = await res.json();
      
      if (data.success) {
        setSubmitResult({ success: true, message: t("success") });
        setShowForm(false);
        setSelectedOrder(null);
        setReason("");
        setNote("");
      } else {
        setSubmitResult({ success: false, message: data.error || t("error") });
      }
    } catch {
      setSubmitResult({ success: false, message: t("error") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {returns.length > 0 ? `${returns.length} ${t("title")}` : ""}
          </p>
        </div>
        {eligibleOrders.length > 0 && (
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? "outline" : "default"}
            size="sm"
            className="gap-2"
          >
            {showForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {t("requestReturn")}
          </Button>
        )}
      </div>

      {/* Submit Result */}
      {submitResult && (
        <Card className={submitResult.success ? "border-green-200 bg-green-50 dark:bg-green-900/10" : "border-red-200 bg-red-50 dark:bg-red-900/10"}>
          <CardContent className="p-4 flex items-center gap-3">
            {submitResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <p className={`text-sm font-medium ${submitResult.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {submitResult.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Return Request Form */}
      {showForm && (
        <Card className="border-amber-200 dark:border-amber-800/50">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-display font-semibold">{t("requestReturn")}</h3>
            
            {/* Order Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("selectOrder")}</label>
              <div className="grid gap-2">
                {eligibleOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-start transition-all ${
                      selectedOrder === order.id
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10"
                        : "border-border hover:border-amber-300"
                    }`}
                  >
                    <div>
                      <span className="font-medium text-sm">{order.name}</span>
                      <span className="text-xs text-muted-foreground block">{order.date}</span>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(order.amount)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("reason")}</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
              />
            </div>

            {/* Note */}
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
              disabled={!selectedOrder || !reason || submitting}
              className="w-full"
            >
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Returns List */}
      {returns.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <RotateCcw className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noReturns")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {returns.map((ret) => (
            <Card key={ret.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-sm">{ret.order_name}</p>
                    <p className="text-xs text-muted-foreground">{ret.order_date}</p>
                  </div>
                  <Badge variant={getStatusVariant(ret.status)} className="gap-1">
                    {getStatusIcon(ret.status)}
                    {ret.status_ar}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">{t("amount")}</span>
                    <p className="font-medium">{formatCurrency(ret.amount)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">{t("returnDate")}</span>
                    <p className="font-medium">{ret.return_date}</p>
                  </div>
                </div>

                {ret.reason && (
                  <div className="mt-3 p-2 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">{t("returnReason")}:</span>
                    <p className="text-sm">{ret.reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
