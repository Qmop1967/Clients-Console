"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Clock, Minus, Plus } from "lucide-react";

// ============================================
// Receipt Status Badge
// ============================================
interface ReceiptStatusBadgeProps {
  quantityOrdered: number;
  quantityReceived?: number;
  size?: "sm" | "md" | "lg";
}

export function ReceiptStatusBadge({
  quantityOrdered,
  quantityReceived = 0,
  size = "md",
}: ReceiptStatusBadgeProps) {
  const t = useTranslations("orders.receipt");

  const percentage = (quantityReceived / quantityOrdered) * 100;
  const isFullyReceived = quantityReceived >= quantityOrdered;
  const isPartiallyReceived = quantityReceived > 0 && quantityReceived < quantityOrdered;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  if (isFullyReceived) {
    return (
      <Badge
        className={`bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border-green-300 ${sizeClasses[size]}`}
      >
        <CheckCircle2 className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
        {t("fullyReceived")}
      </Badge>
    );
  }

  if (isPartiallyReceived) {
    return (
      <Badge
        className={`bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 ${sizeClasses[size]}`}
      >
        <Clock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
        {t("partiallyReceived")} ({Math.round(percentage)}%)
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 border-red-300 ${sizeClasses[size]}`}
    >
      <Circle className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
      {t("notReceived")}
    </Badge>
  );
}

// ============================================
// Receipt Progress Bar
// ============================================
interface ReceiptProgressBarProps {
  quantityOrdered: number;
  quantityReceived?: number;
  showLabel?: boolean;
}

export function ReceiptProgressBar({
  quantityOrdered,
  quantityReceived = 0,
  showLabel = true,
}: ReceiptProgressBarProps) {
  const t = useTranslations("orders.receipt");

  const percentage = Math.min((quantityReceived / quantityOrdered) * 100, 100);
  const isFullyReceived = quantityReceived >= quantityOrdered;
  const isPartiallyReceived = quantityReceived > 0 && quantityReceived < quantityOrdered;

  const getProgressColor = () => {
    if (isFullyReceived) return "bg-green-500";
    if (isPartiallyReceived) return "bg-orange-500";
    return "bg-red-300";
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Progress value={percentage} className="h-2" indicatorClassName={getProgressColor()} />
      </div>
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {t("received")}: {quantityReceived} / {quantityOrdered}
          </span>
          <span className={`font-medium ${isFullyReceived ? "text-green-600" : isPartiallyReceived ? "text-orange-600" : "text-red-600"}`}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// Receipt Confirmation Modal
// ============================================
interface ReceiptConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  quantityOrdered: number;
  quantityReceived?: number;
  onConfirm: (quantity: number) => Promise<void>;
  loading?: boolean;
}

export function ReceiptConfirmationModal({
  open,
  onOpenChange,
  itemName,
  quantityOrdered,
  quantityReceived = 0,
  onConfirm,
  loading = false,
}: ReceiptConfirmationModalProps) {
  const t = useTranslations("orders.receipt");

  const remainingQuantity = quantityOrdered - quantityReceived;
  const [quantity, setQuantity] = useState(remainingQuantity);

  // Reset quantity when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setQuantity(remainingQuantity);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    if (quantity > 0 && quantity <= remainingQuantity) {
      await onConfirm(quantity);
      onOpenChange(false);
    }
  };

  const incrementQuantity = () => {
    if (quantity < remainingQuantity) {
      setQuantity(quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("confirmReceipt")}</DialogTitle>
          <DialogDescription>{t("confirmReceiptDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Item Info */}
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">{t("item")}</Label>
            <p className="font-medium">{itemName}</p>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">{t("ordered")}</Label>
              <p className="font-semibold text-lg">{quantityOrdered}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t("previouslyReceived")}</Label>
              <p className="font-semibold text-lg">{quantityReceived}</p>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="space-y-2">
            <Label htmlFor="quantity">{t("quantityToReceive")}</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={decrementQuantity}
                disabled={quantity <= 1 || loading}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={remainingQuantity}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setQuantity(Math.min(Math.max(1, val), remainingQuantity));
                }}
                className="text-center text-lg font-semibold"
                disabled={loading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={incrementQuantity}
                disabled={quantity >= remainingQuantity || loading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("remaining")}: {remainingQuantity} {t("units")}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={quantity === 0 || loading}>
            {loading ? t("confirming") : t("confirmReceive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Receipt Timeline Event
// ============================================
export interface ReceiptEvent {
  timestamp: string;
  quantity: number;
  totalReceived: number;
  receivedBy?: string;
}

interface ReceiptTimelineProps {
  events: ReceiptEvent[];
  quantityOrdered: number;
}

export function ReceiptTimeline({ events, quantityOrdered }: ReceiptTimelineProps) {
  const t = useTranslations("orders.receipt");

  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t("noReceiptsYet")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const isFullyReceived = event.totalReceived >= quantityOrdered;
        const date = new Date(event.timestamp);

        return (
          <div key={index} className="flex gap-4">
            {/* Timeline Icon */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isFullyReceived
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                    : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </div>
              {index < events.length - 1 && (
                <div className="w-0.5 h-full bg-muted mt-2" />
              )}
            </div>

            {/* Event Details */}
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {t("receivedQuantity", { quantity: event.quantity })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("totalReceived")}: {event.totalReceived} / {quantityOrdered}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{date.toLocaleDateString()}</p>
                  <p>{date.toLocaleTimeString()}</p>
                </div>
              </div>
              {event.receivedBy && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("by")}: {event.receivedBy}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
