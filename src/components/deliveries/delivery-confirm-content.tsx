"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  Package,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Truck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DeliveryReceipt } from "@/lib/odoo/deliveries";

interface ItemConfirmation {
  product_id: number;
  product_name: string;
  qty_demand: number;
  qty_done: number;
  received: boolean;
  note: string;
}

interface DeliveryConfirmContentProps {
  deliveries: DeliveryReceipt[];
}

export function DeliveryConfirmContent({ deliveries }: DeliveryConfirmContentProps) {
  const t = useTranslations("deliveryConfirm");
  const { toast } = useToast();
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryReceipt | null>(null);
  const [itemConfirmations, setItemConfirmations] = useState<ItemConfirmation[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<number[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const selectDelivery = (delivery: DeliveryReceipt) => {
    setSelectedDelivery(delivery);
    setItemConfirmations(
      delivery.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        qty_demand: item.qty_demand,
        qty_done: item.qty_done,
        received: false,
        note: "",
      }))
    );
    setGeneralNotes("");
  };

  const toggleItem = (idx: number) => {
    setItemConfirmations((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, received: !item.received } : item
      )
    );
  };

  const updateNote = (idx: number, note: string) => {
    setItemConfirmations((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, note } : item))
    );
  };

  const markAll = () => {
    setItemConfirmations((prev) =>
      prev.map((item) => ({ ...item, received: true }))
    );
  };

  const allReceived = itemConfirmations.length > 0 && itemConfirmations.every((i) => i.received);
  const receivedCount = itemConfirmations.filter((i) => i.received).length;

  const handleSubmit = async () => {
    if (!selectedDelivery) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/orders/${selectedDelivery.id}/delivery-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemConfirmations.map((i) => ({
            product_id: i.product_id,
            received: i.received,
            received_qty: i.received ? i.qty_done : 0,
            note: i.note,
          })),
          notes: generalNotes,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({ title: t("success"), variant: "default" });
        setConfirmed((prev) => [...prev, selectedDelivery.id]);
        setSelectedDelivery(null);
        setConfirmDialogOpen(false);
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (error) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pendingDeliveries = deliveries.filter((d) => !confirmed.includes(d.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* If no delivery selected: show list */}
      {!selectedDelivery ? (
        <>
          {pendingDeliveries.length === 0 ? (
            <Card variant="elevated" className="py-12">
              <CardContent className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{t("noDeliveries")}</h3>
                <p className="text-sm text-muted-foreground">{t("noDeliveriesDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingDeliveries.map((d) => (
                <Card
                  key={d.id}
                  variant="interactive"
                  className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-amber-500/30"
                  onClick={() => selectDelivery(d)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                          <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <span className="font-display font-semibold block">{d.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {d.origin && `${t("source")}: ${d.origin}`}
                            {d.date_done && ` • ${String(d.date_done).split(" ")[0]}`}
                          </span>
                        </div>
                      </div>
                      <div className="text-end">
                        <Badge variant="secondary">{d.total_items} {t("items")}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Delivery confirmation form */
        <div className="space-y-4">
          {/* Back + Info Header */}
          <Card variant="elevated">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDelivery(null)}>
                  ← {t("back")}
                </Button>
                <Badge variant="secondary">
                  {receivedCount}/{itemConfirmations.length} {t("checked")}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="font-display font-semibold block">{selectedDelivery.name}</span>
                  <span className="text-sm text-muted-foreground">{selectedDelivery.origin}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mark All Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={markAll}
            disabled={allReceived}
          >
            <CheckCircle2 className="h-4 w-4 me-2" />
            {t("markAll")}
          </Button>

          {/* Items List */}
          <div className="space-y-3">
            {itemConfirmations.map((item, idx) => (
              <Card key={idx} variant="elevated" className={`overflow-hidden transition-all ${item.received ? "ring-2 ring-green-500/30" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("expectedQty")}: {Math.round(item.qty_done)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.received && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      <Switch
                        checked={item.received}
                        onCheckedChange={() => toggleItem(idx)}
                      />
                    </div>
                  </div>

                  {/* Note input */}
                  <div className="relative">
                    <MessageSquare className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      value={item.note}
                      onChange={(e) => updateNote(idx, e.target.value)}
                      placeholder={t("itemNotePlaceholder")}
                      className="ps-10 min-h-[60px] text-sm resize-none"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* General Notes */}
          <Card variant="elevated">
            <CardContent className="p-4 space-y-2">
              <label className="text-sm font-medium">{t("generalNotes")}</label>
              <Textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder={t("generalNotesPlaceholder")}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            variant="gold"
            size="lg"
            className="w-full"
            onClick={() => setConfirmDialogOpen(true)}
            disabled={receivedCount === 0}
          >
            <ClipboardCheck className="h-5 w-5 me-2" />
            {t("confirmDelivery")} ({receivedCount}/{itemConfirmations.length})
          </Button>

          {/* Confirmation Dialog */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {allReceived ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  {t("confirmTitle")}
                </DialogTitle>
                <DialogDescription>
                  {allReceived
                    ? t("confirmAllReceived")
                    : t("confirmPartial", { received: receivedCount, total: itemConfirmations.length })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  variant="default"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin me-1" />}
                  {t("confirm")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
