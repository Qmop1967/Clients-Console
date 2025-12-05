"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Calendar,
  Package,
  Truck,
  CheckCircle2,
  FileText,
  X,
  PackageCheck,
  User,
  Box,
  FileDown,
  ExternalLink,
  MapPin,
} from "lucide-react";
import type { ZohoSalesOrder, ZohoPackage, ZohoShipment } from "@/types";

interface OrderDetailContentProps {
  order: ZohoSalesOrder;
  packages: ZohoPackage[];
  shipments: ZohoShipment[];
  currencyCode: string;
}

export function OrderDetailContent({
  order,
  packages,
  shipments,
  currencyCode,
}: OrderDetailContentProps) {
  const t = useTranslations("orders");
  const [packagesDialogOpen, setPackagesDialogOpen] = useState(false);
  const [shipmentsDialogOpen, setShipmentsDialogOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || order.currency_code || currencyCode;
    const decimals = curr === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${curr}`
    );
  };

  // Status steps for timeline
  const statusSteps = [
    { key: "confirmed", label: t("orderStatus.confirmed"), icon: CheckCircle2, clickable: false },
    { key: "packed", label: t("orderStatus.packed"), icon: PackageCheck, clickable: packages.length > 0 },
    { key: "shipped", label: t("orderStatus.shipped"), icon: Truck, clickable: shipments.length > 0 },
    { key: "invoiced", label: t("orderStatus.invoiced"), icon: FileText, clickable: false },
  ];

  const getStatusIndex = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusOrder: Record<string, number> = {
      draft: -1,
      pending: -1,
      confirmed: 0,
      open: 0,
      packed: 1,
      shipped: 2,
      delivered: 3,
      invoiced: 3,
      cancelled: -2,
    };
    return statusOrder[statusLower] ?? -1;
  };

  const currentStatusIndex = getStatusIndex(order.status);
  const isCancelled = order.status?.toLowerCase() === "cancelled";

  const getStatusInfo = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusMap: Record<string, {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      color: string;
      bgColor: string;
    }> = {
      draft: { label: t("orderStatus.draft"), variant: "outline", color: "text-gray-600", bgColor: "bg-gray-100" },
      pending: { label: t("orderStatus.draft"), variant: "outline", color: "text-amber-600", bgColor: "bg-amber-50" },
      confirmed: { label: t("orderStatus.confirmed"), variant: "secondary", color: "text-blue-600", bgColor: "bg-blue-50" },
      open: { label: t("orderStatus.confirmed"), variant: "secondary", color: "text-blue-600", bgColor: "bg-blue-50" },
      packed: { label: t("orderStatus.packed"), variant: "secondary", color: "text-purple-600", bgColor: "bg-purple-50" },
      shipped: { label: t("orderStatus.shipped"), variant: "secondary", color: "text-indigo-600", bgColor: "bg-indigo-50" },
      delivered: { label: t("orderStatus.delivered"), variant: "default", color: "text-green-600", bgColor: "bg-green-50" },
      invoiced: { label: t("orderStatus.invoiced"), variant: "default", color: "text-emerald-600", bgColor: "bg-emerald-50" },
      cancelled: { label: t("orderStatus.cancelled"), variant: "destructive", color: "text-red-600", bgColor: "bg-red-50" },
    };
    return statusMap[statusLower] || statusMap.draft;
  };

  const handleTimelineClick = (index: number) => {
    if (index === 1 && packages.length > 0) {
      setPackagesDialogOpen(true);
    } else if (index === 2 && shipments.length > 0) {
      setShipmentsDialogOpen(true);
    }
  };

  const getItemImageUrl = (itemId: string) => {
    return `/api/zoho/images/${itemId}`;
  };

  const handleImageError = (itemId: string) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

  const statusInfo = getStatusInfo(order.status);
  const currency = order.currency_code || currencyCode;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/orders">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${statusInfo.bgColor} dark:bg-opacity-20`}>
                <FileText className={`h-5 w-5 ${statusInfo.color}`} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {order.salesorder_number}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {order.date}
                </p>
              </div>
            </div>
          </div>
          <Badge variant={statusInfo.variant} className="text-sm px-4 py-1.5 self-start sm:self-auto">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Interactive Status Timeline */}
        {!isCancelled && currentStatusIndex >= 0 && (
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between relative">
                {/* Progress line background */}
                <div className="absolute left-0 right-0 top-5 h-1 bg-muted mx-8" />
                {/* Progress line filled */}
                <div
                  className="absolute left-0 top-5 h-1 bg-primary mx-8 transition-all duration-500"
                  style={{
                    width: `calc(${(currentStatusIndex / (statusSteps.length - 1)) * 100}% - 4rem)`,
                    maxWidth: 'calc(100% - 4rem)'
                  }}
                />

                {statusSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;
                  const isClickable = step.clickable && isCompleted;

                  return (
                    <button
                      key={step.key}
                      onClick={() => handleTimelineClick(index)}
                      disabled={!isClickable}
                      className={`flex flex-col items-center relative z-10 transition-all ${
                        isClickable ? "cursor-pointer hover:scale-110" : "cursor-default"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        } ${isCurrent ? "ring-4 ring-primary/20" : ""} ${
                          isClickable ? "hover:ring-4 hover:ring-primary/30" : ""
                        }`}
                      >
                        <StepIcon className="h-5 w-5" />
                      </div>
                      <span className={`text-xs mt-2 font-medium text-center max-w-[80px] ${
                        isCompleted ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {step.label}
                      </span>
                      {isClickable && (
                        <span className="text-[10px] text-primary mt-0.5">
                          {index === 1 ? `${packages.length} ${t("packages")}` : `${shipments.length} ${t("shipment")}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancelled Notice */}
        {isCancelled && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <X className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">{t("orderStatus.cancelled")}</p>
                <p className="text-sm text-muted-foreground">{t("orderCancelledDescription")}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                <ShoppingBag className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("total")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{formatCurrency(order.total)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                <Package className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("items")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{order.line_items?.length || 0}</p>
            </CardContent>
          </Card>

          {packages.length > 0 && (
            <Card
              className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200/50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setPackagesDialogOpen(true)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <PackageCheck className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t("packages")}</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{packages.length}</p>
              </CardContent>
            </Card>
          )}

          {shipments.length > 0 && (
            <Card
              className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShipmentsDialogOpen(true)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <Truck className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t("shipment")}</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{shipments.length}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Customer Info */}
        {order.customer_name && (
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("customer")}</p>
                <p className="font-semibold">{order.customer_name}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Line Items with Images */}
        {order.line_items && order.line_items.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                {t("orderDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-0 divide-y">
                {order.line_items.map((item, index) => (
                  <div
                    key={item.line_item_id || index}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Item Image */}
                    <div className="w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden relative">
                      {!imageErrors[item.item_id] ? (
                        <Image
                          src={getItemImageUrl(item.item_id)}
                          alt={item.item_name || "Product"}
                          fill
                          className="object-cover"
                          onError={() => handleImageError(item.item_id)}
                          sizes="64px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Box className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base">
                        {item.name || item.item_name || item.description || `Item #${index + 1}`}
                      </p>
                      {item.sku && (
                        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                      )}
                      {item.description && (item.name || item.item_name) && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {item.quantity} × {formatCurrency(item.rate, currency)}
                        </Badge>
                        {item.discount && item.discount > 0 && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                            -{item.discount}% {t("discount")}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Item Total */}
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatCurrency(item.item_total, currency)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-6 pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span>{formatCurrency(order.sub_total || order.total, currency)}</span>
                </div>
                {order.tax_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("tax")}</span>
                    <span>{formatCurrency(order.tax_total, currency)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t("discount")}</span>
                    <span>-{formatCurrency(order.discount, currency)}</span>
                  </div>
                )}
                {order.shipping_charge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("shipping")}</span>
                    <span>{formatCurrency(order.shipping_charge, currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold pt-1">
                  <span>{t("total")}</span>
                  <span className="text-primary">{formatCurrency(order.total, currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes & Terms */}
        {order.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("notes")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{order.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/orders">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("backToOrders")}
            </Button>
          </Link>
          <Link href="/products">
            <Button className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t("continueShopping")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Packages Dialog */}
      <Dialog open={packagesDialogOpen} onOpenChange={setPackagesDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-purple-600" />
              {t("packagesTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {packages.map((pkg) => {
              const statusLower = pkg.status?.toLowerCase() || '';
              const isDelivered = statusLower === 'delivered';
              const isShipped = statusLower === 'shipped' || statusLower === 'in_transit';

              return (
                <Card key={pkg.package_id} className="overflow-hidden">
                  <CardHeader className="py-3 px-4 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-purple-600" />
                        <span className="font-semibold">{pkg.package_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isDelivered ? "default" : isShipped ? "secondary" : "outline"}
                          className={isDelivered ? "bg-green-600" : ""}
                        >
                          {pkg.status || t("carton")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Package Info Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">{t("packageDate")}</p>
                        <p className="font-medium">{pkg.date}</p>
                      </div>
                      {pkg.carrier && (
                        <div>
                          <p className="text-muted-foreground text-xs">{t("carrier")}</p>
                          <p className="font-medium">{pkg.carrier}</p>
                        </div>
                      )}
                      {pkg.tracking_number && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs">{t("trackingNumber")}</p>
                          <p className="font-medium">{pkg.tracking_number}</p>
                        </div>
                      )}
                    </div>

                    {/* Carrier Badge if present */}
                    {pkg.carrier && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <Truck className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">{pkg.carrier}</span>
                      </div>
                    )}

                    {/* Package Contents */}
                    {pkg.line_items && pkg.line_items.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          {t("packageContents")} ({pkg.line_items.length})
                        </p>
                        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                          {pkg.line_items.map((item, itemIndex) => (
                            <div key={item.line_item_id || itemIndex} className="flex items-center gap-3 text-sm">
                              <div className="w-8 h-8 rounded bg-background flex items-center justify-center shrink-0 border">
                                <Box className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">{item.item_name}</p>
                                {item.sku && (
                                  <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                )}
                              </div>
                              <Badge variant="secondary" className="shrink-0">×{item.quantity}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {pkg.notes && (
                      <div className="text-sm">
                        <p className="text-muted-foreground text-xs mb-1">{t("notes")}</p>
                        <p className="text-muted-foreground">{pkg.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {packages.length === 0 && (
              <p className="text-center text-muted-foreground py-4">{t("noPackages")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shipments Dialog */}
      <Dialog open={shipmentsDialogOpen} onOpenChange={setShipmentsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600" />
              {t("shipmentTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <Card key={shipment.shipment_id} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-green-600" />
                      <span className="font-semibold">{shipment.shipment_number}</span>
                    </div>
                    <Badge variant={shipment.status === "delivered" ? "default" : "secondary"}>
                      {shipment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Carrier Info */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                      <Truck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("carrier")}</p>
                      <p className="font-semibold">{shipment.carrier || t("notSpecified")}</p>
                    </div>
                  </div>

                  {/* Shipment Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t("shipmentDate")}</p>
                      <p className="font-medium">{shipment.date}</p>
                    </div>
                    {shipment.delivery_date && (
                      <div>
                        <p className="text-muted-foreground">{t("deliveryDate")}</p>
                        <p className="font-medium">{shipment.delivery_date}</p>
                      </div>
                    )}
                    {shipment.tracking_number && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">{t("trackingNumber")}</p>
                        <p className="font-medium">{shipment.tracking_number}</p>
                      </div>
                    )}
                  </div>

                  {/* Tracking URL */}
                  {shipment.tracking_url && (
                    <a
                      href={shipment.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <MapPin className="h-4 w-4" />
                      {t("trackShipment")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* Documents/Attachments */}
                  {shipment.documents && shipment.documents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t("attachments")}</p>
                      <div className="space-y-2">
                        {shipment.documents.map((doc) => (
                          <div
                            key={doc.document_id}
                            className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <FileDown className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">{doc.file_type}</p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {shipment.notes && (
                    <div>
                      <p className="text-sm font-medium mb-1">{t("notes")}</p>
                      <p className="text-sm text-muted-foreground">{shipment.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {shipments.length === 0 && (
              <p className="text-center text-muted-foreground py-4">{t("noShipments")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
