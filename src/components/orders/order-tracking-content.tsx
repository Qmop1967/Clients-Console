"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  PackageCheck,
  Truck,
  MapPin,
  Calendar,
  Clock,
  Package,
  ExternalLink,
  ShoppingBag,
  CircleDot,
  Circle,
} from "lucide-react";
import type { SalesOrder, ShipmentPackage, Shipment } from "@/types";

interface OrderTrackingContentProps {
  order: SalesOrder;
  packages: ShipmentPackage[];
  shipments: Shipment[];
  currencyCode: string;
}

type TrackingStepStatus = "completed" | "current" | "pending";

interface TrackingStep {
  key: string;
  icon: React.ElementType;
  status: TrackingStepStatus;
  date?: string;
  detail?: string;
}

export function OrderTrackingContent({
  order,
  packages,
  shipments,
  currencyCode,
}: OrderTrackingContentProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");

  const formatCurrency = (amount: number) => {
    const curr = order.currency_code || currencyCode;
    const decimals = curr === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${curr}`
    );
  };

  // Build tracking steps based on order state
  const getStatusLevel = (status: string): number => {
    const map: Record<string, number> = {
      draft: 0,
      confirmed: 1,
      open: 1,
      packed: 2,
      shipped: 3,
      delivered: 4,
      invoiced: 4,
      cancelled: -1,
    };
    return map[status?.toLowerCase()] ?? 0;
  };

  const currentLevel = getStatusLevel(order.status);
  const isCancelled = order.status?.toLowerCase() === "cancelled";

  const buildSteps = (): TrackingStep[] => {
    const steps: TrackingStep[] = [
      {
        key: "ordered",
        icon: ShoppingBag,
        status: currentLevel >= 0 ? "completed" : "pending",
        date: order.date,
        detail: order.salesorder_number,
      },
      {
        key: "confirmed",
        icon: CheckCircle2,
        status: currentLevel >= 1 ? "completed" : currentLevel === 0 ? "current" : "pending",
        date: currentLevel >= 1 ? order.date : undefined,
      },
      {
        key: "packed",
        icon: PackageCheck,
        status: currentLevel >= 2 ? "completed" : currentLevel === 1 ? "current" : "pending",
        date: packages.length > 0 ? packages[0].date : undefined,
        detail: packages.length > 0 ? `${packages.length} ${t("packages")}` : undefined,
      },
      {
        key: "shipped",
        icon: Truck,
        status: currentLevel >= 3 ? "completed" : currentLevel === 2 ? "current" : "pending",
        date: shipments.length > 0 ? shipments[0].date : undefined,
        detail: shipments.length > 0 ? (shipments[0].carrier || undefined) : undefined,
      },
      {
        key: "delivered",
        icon: MapPin,
        status: currentLevel >= 4 ? "completed" : currentLevel === 3 ? "current" : "pending",
        date: shipments.length > 0 ? shipments[0].delivery_date : undefined,
      },
    ];

    // Mark the highest completed as "current" if it's the active one
    const highestCompleted = steps.reduce((acc, step, i) => (step.status === "completed" ? i : acc), -1);
    if (highestCompleted >= 0 && highestCompleted < steps.length - 1) {
      // The next pending step becomes current
      const nextIdx = highestCompleted + 1;
      if (steps[nextIdx].status === "pending") {
        steps[nextIdx].status = "current";
      }
    }

    return steps;
  };

  const steps = isCancelled ? [] : buildSteps();

  const getStepStatusLabel = (status: string): string => {
    switch (status) {
      case "ordered":
        return t("tracking.stepOrdered");
      case "confirmed":
        return t("orderStatus.confirmed");
      case "packed":
        return t("orderStatus.packed");
      case "shipped":
        return t("orderStatus.shipped");
      case "delivered":
        return t("orderStatus.delivered");
      default:
        return status;
    }
  };

  const getStatusColor = (stepStatus: TrackingStepStatus) => {
    switch (stepStatus) {
      case "completed":
        return "text-green-600 dark:text-green-400";
      case "current":
        return "text-blue-600 dark:text-blue-400";
      case "pending":
        return "text-muted-foreground";
    }
  };

  const getStatusBg = (stepStatus: TrackingStepStatus) => {
    switch (stepStatus) {
      case "completed":
        return "bg-green-600 dark:bg-green-500";
      case "current":
        return "bg-blue-600 dark:bg-blue-500 animate-pulse";
      case "pending":
        return "bg-muted";
    }
  };

  const getIconBg = (stepStatus: TrackingStepStatus) => {
    switch (stepStatus) {
      case "completed":
        return "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800";
      case "current":
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 ring-4 ring-blue-100 dark:ring-blue-900/20";
      case "pending":
        return "bg-muted border-border";
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/orders/${order.salesorder_id}`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-display font-bold">
              {t("trackOrder")}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <FileText className="h-3.5 w-3.5" />
              {order.salesorder_number}
              <span className="mx-1">·</span>
              <Calendar className="h-3.5 w-3.5" />
              {order.date}
            </p>
          </div>
          <Badge
            variant={isCancelled ? "destructive" : currentLevel >= 4 ? "default" : "secondary"}
            className="text-xs px-3 py-1"
          >
            {isCancelled ? t("orderStatus.cancelled") : currentLevel >= 4 ? t("orderStatus.delivered") : t("tracking.inTransit")}
          </Badge>
        </div>

        {/* Order Summary Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("total")}</p>
                <p className="text-xl font-bold">{formatCurrency(order.total)}</p>
              </div>
              <div className="text-end">
                <p className="text-sm text-muted-foreground">{t("items")}</p>
                <p className="text-xl font-bold">{order.line_items?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cancelled Notice */}
        {isCancelled && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6 text-center">
              <div className="p-3 rounded-full bg-destructive/10 w-fit mx-auto mb-3">
                <Circle className="h-8 w-8 text-destructive" />
              </div>
              <p className="font-semibold text-destructive">{t("orderStatus.cancelled")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("orderCancelledDescription")}</p>
            </CardContent>
          </Card>
        )}

        {/* Vertical Timeline */}
        {!isCancelled && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("tracking.timeline")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <div className="relative">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isLast = index === steps.length - 1;

                  return (
                    <div key={step.key} className="flex gap-4 relative">
                      {/* Vertical line */}
                      {!isLast && (
                        <div className="absolute start-[19px] top-[44px] bottom-0 w-0.5">
                          <div
                            className={`w-full h-full ${
                              step.status === "completed"
                                ? "bg-green-300 dark:bg-green-700"
                                : "bg-border"
                            }`}
                          />
                        </div>
                      )}

                      {/* Icon */}
                      <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${getIconBg(step.status)}`}>
                        <StepIcon className={`h-4 w-4 ${getStatusColor(step.status)}`} />
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-8 ${isLast ? "pb-0" : ""}`}>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold text-sm ${getStatusColor(step.status)}`}>
                            {getStepStatusLabel(step.key)}
                          </p>
                          {step.status === "completed" && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          )}
                          {step.status === "current" && (
                            <CircleDot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                          )}
                        </div>
                        {step.date && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {step.date}
                          </p>
                        )}
                        {step.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipment Details */}
        {shipments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                {t("shipmentTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {shipments.map((shipment) => (
                <div
                  key={shipment.shipment_id}
                  className="p-4 rounded-lg border bg-muted/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{shipment.shipment_number}</p>
                    <Badge variant={shipment.status === "delivered" ? "default" : "secondary"} className="text-xs">
                      {shipment.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {shipment.carrier && (
                      <div>
                        <p className="text-xs text-muted-foreground">{t("carrier")}</p>
                        <p className="font-medium flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {shipment.carrier}
                        </p>
                      </div>
                    )}
                    {shipment.tracking_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">{t("trackingNumber")}</p>
                        <p className="font-medium font-mono text-xs">{shipment.tracking_number}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">{t("shipmentDate")}</p>
                      <p className="font-medium">{shipment.date}</p>
                    </div>
                    {shipment.delivery_date && (
                      <div>
                        <p className="text-xs text-muted-foreground">{t("deliveryDate")}</p>
                        <p className="font-medium">{shipment.delivery_date}</p>
                      </div>
                    )}
                  </div>

                  {shipment.tracking_url && (
                    <a
                      href={shipment.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                    >
                      <MapPin className="h-4 w-4" />
                      {t("trackShipment")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Packages */}
        {packages.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t("packagesTitle")}
                <Badge variant="secondary" className="text-xs">{packages.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.package_id}
                  className="p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{pkg.package_number}</p>
                    <span className="text-xs text-muted-foreground">{pkg.date}</span>
                  </div>
                  {pkg.line_items && pkg.line_items.length > 0 && (
                    <div className="space-y-1">
                      {pkg.line_items.map((item, i) => (
                        <div key={item.line_item_id || i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate">{item.item_name}</span>
                          <Badge variant="outline" className="text-xs shrink-0 ms-2">×{item.quantity}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Link href={`/orders/${order.salesorder_id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("backToOrders")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
