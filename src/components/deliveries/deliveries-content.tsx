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
} from "@/components/ui/dialog";
import {
  Truck,
  Package,
  Calendar,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Camera,
  X,
  ZoomIn,
} from "lucide-react";
import type { DeliveryReceipt } from "@/lib/odoo/deliveries";

interface DeliveriesContentProps {
  deliveries: DeliveryReceipt[];
}

export function DeliveriesContent({ deliveries }: DeliveriesContentProps) {
  const t = useTranslations("deliveries");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; delivery: DeliveryReceipt | null }>({
    open: false,
    delivery: null,
  });
  const [receiptImageView, setReceiptImageView] = useState<string | null>(null);

  const formatDate = (date: string | false) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return String(date).split(" ")[0];
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Stats */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/20">
              <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("totalDeliveries")}</p>
              <p className="stat-number text-3xl">{deliveries.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <Card variant="elevated" className="py-12">
          <CardContent className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Truck className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">{t("noDeliveries")}</h3>
            <p className="text-sm text-muted-foreground">{t("noDeliveriesDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => {
            const isExpanded = expandedId === d.id;
            return (
              <Card key={d.id} variant="elevated" className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-900/20">
                        <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <span className="font-display font-semibold block">{d.name}</span>
                        {d.origin && (
                          <span className="text-xs text-muted-foreground">{t("source")}: {d.origin}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="default" className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("completed")}
                    </Badge>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {d.date_done && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <span className="text-xs text-muted-foreground block">{t("deliveryDate")}</span>
                          <span className="font-medium">{formatDate(d.date_done)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-xs text-muted-foreground block">{t("itemCount")}</span>
                        <span className="font-medium">{d.total_items} {t("items")}</span>
                      </div>
                    </div>
                    {(d.carrier_name || d.carrier) && (
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <span className="text-xs text-muted-foreground block">{t("carrier")}</span>
                          <span className="font-medium text-xs">{d.carrier_name || d.carrier}</span>
                        </div>
                      </div>
                    )}
                    {(d.receipt_number || d.tracking_number) && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <span className="text-xs text-muted-foreground block">{t("trackingNumber")}</span>
                          <span className="font-medium text-xs">{d.receipt_number || d.tracking_number}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transport Receipt Image */}
                  {d.receipt_image && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">{t("transportReceipt")}</span>
                      </div>
                      <button
                        onClick={() => setReceiptImageView(d.receipt_image)}
                        className="relative w-full group"
                      >
                        <img
                          src={"data:image/jpeg;base64," + d.receipt_image}
                          alt={t("transportReceipt")}
                          className="w-full rounded-lg max-h-48 object-cover border"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Toggle Items */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(d.id)}
                    className="w-full justify-center text-muted-foreground"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 me-1" />
                        {t("hideItems")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 me-1" />
                        {t("showItems")} ({d.total_items})
                      </>
                    )}
                  </Button>

                  {/* Expanded Items */}
                  {isExpanded && d.items.length > 0 && (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                        <span>{t("product")}</span>
                        <span>{t("ordered")}</span>
                        <span>{t("delivered")}</span>
                      </div>
                      {d.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-2 text-sm items-center">
                          <span className="truncate">{item.product_name}</span>
                          <span className="text-muted-foreground text-center min-w-[40px]">{Math.round(item.qty_demand)}</span>
                          <span className="font-medium text-center min-w-[40px]">{Math.round(item.qty_done)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Fullscreen Receipt Image Viewer */}
      {receiptImageView && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setReceiptImageView(null)}
        >
          <button
            onClick={() => setReceiptImageView(null)}
            className="absolute top-4 end-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            style={{ top: "max(16px, env(safe-area-inset-top))" }}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={"data:image/jpeg;base64," + receiptImageView}
            alt={t("transportReceipt")}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
