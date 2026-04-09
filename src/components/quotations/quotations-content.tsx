"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder } from "@/types";

interface QuotationsContentProps {
  quotations: (SalesOrder & { validity_date?: string; client_approved?: boolean })[];
  currencyCode: string;
}

export function QuotationsContent({ quotations, currencyCode }: QuotationsContentProps) {
  const t = useTranslations("quotations");
  const { toast } = useToast();
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject";
    orderId: string;
    orderName: string;
  }>({ open: false, action: "approve", orderId: "", orderName: "" });

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || currencyCode;
    const decimals = curr === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${curr}`
    );
  };

  const handleAction = async (orderId: string, action: "approve" | "reject") => {
    setLoading(prev => ({ ...prev, [orderId]: action }));
    try {
      const endpoint = action === "approve"
        ? `/api/orders/${orderId}/approve`
        : `/api/orders/${orderId}/reject`;

      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();

      if (res.ok) {
        toast({
          title: action === "approve" ? t("approveSuccess") : t("rejectSuccess"),
          variant: "default",
        });
        setDismissed(prev => [...prev, orderId]);
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (error) {
      toast({
        title: action === "approve" ? t("approveError") : t("rejectError"),
        description: error instanceof Error ? error.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      setConfirmDialog(prev => ({ ...prev, open: false }));
    }
  };

  const openConfirm = (orderId: string, orderName: string, action: "approve" | "reject") => {
    setConfirmDialog({ open: true, action, orderId, orderName });
  };

  const visibleQuotations = quotations.filter(q => !dismissed.includes(q.salesorder_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
                <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("pending")}</p>
                <p className="stat-number text-3xl">{visibleQuotations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("totalValue")}</p>
                <p className="price-display text-lg">
                  {formatCurrency(visibleQuotations.reduce((s, q) => s + q.total, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotations List */}
      {visibleQuotations.length === 0 ? (
        <Card variant="elevated" className="py-12">
          <CardContent className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">{t("noQuotations")}</h3>
            <p className="text-sm text-muted-foreground">{t("noQuotationsDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleQuotations.map((q) => (
            <Card key={q.salesorder_id} variant="elevated" className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <span className="font-display font-semibold block">{q.salesorder_number}</span>
                      <span className="text-sm text-muted-foreground">{q.date}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {q.status === "sent" ? t("statusSent") : t("statusDraft")}
                  </Badge>
                </div>

                {/* Line Items Preview */}
                {q.line_items && q.line_items.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="space-y-1">
                      {q.line_items.slice(0, 3).map((item) => (
                        <div key={item.line_item_id} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{item.item_name || item.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ms-2">
                            <span className="text-muted-foreground">×{item.quantity}</span>
                            <span className="font-medium">{formatCurrency(item.item_total)}</span>
                          </div>
                        </div>
                      ))}
                      {q.line_items.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{q.line_items.length - 3} {t("moreItems")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Total + Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("total")}</p>
                    <p className="price-tag font-bold text-lg">{formatCurrency(q.total, q.currency_code)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirm(q.salesorder_id, q.salesorder_number, "reject")}
                      disabled={!!loading[q.salesorder_id]}
                      className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      {loading[q.salesorder_id] === "reject" ? (
                        <Loader2 className="h-4 w-4 animate-spin me-1" />
                      ) : (
                        <XCircle className="h-4 w-4 me-1" />
                      )}
                      {t("reject")}
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => openConfirm(q.salesorder_id, q.salesorder_number, "approve")}
                      disabled={!!loading[q.salesorder_id]}
                    >
                      {loading[q.salesorder_id] === "approve" ? (
                        <Loader2 className="h-4 w-4 animate-spin me-1" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 me-1" />
                      )}
                      {t("approve")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.action === "approve" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              {confirmDialog.action === "approve" ? t("confirmApproveTitle") : t("confirmRejectTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "approve"
                ? t("confirmApproveDesc", { order: confirmDialog.orderName })
                : t("confirmRejectDesc", { order: confirmDialog.orderName })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
              {t("cancel")}
            </Button>
            <Button
              variant={confirmDialog.action === "approve" ? "default" : "destructive"}
              onClick={() => handleAction(confirmDialog.orderId, confirmDialog.action)}
              disabled={!!loading[confirmDialog.orderId]}
            >
              {loading[confirmDialog.orderId] ? (
                <Loader2 className="h-4 w-4 animate-spin me-1" />
              ) : null}
              {confirmDialog.action === "approve" ? t("approve") : t("reject")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
