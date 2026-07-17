"use client";

import { Fragment, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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
  Clock,
  Handshake,
} from "lucide-react";
import type { SalesOrder, ShipmentPackage, Shipment, Invoice } from "@/types";
import {
  ReceiptStatusBadge,
  ReceiptProgressBar,
  ReceiptConfirmationModal,
  ReceiptTimeline,
  type ReceiptEvent,
} from "@/components/orders/receipt-tracking";
import { useToast } from "@/hooks/use-toast";

interface OrderDetailContentProps {
  order: SalesOrder;
  packages: ShipmentPackage[];
  shipments: Shipment[];
  invoices?: Invoice[];
  currencyCode: string;
}

export function OrderDetailContent({
  order,
  packages,
  shipments,
  invoices = [],
  currencyCode,
}: OrderDetailContentProps) {
  const t = useTranslations("orders");
  const tInv = useTranslations("invoices");
  const locale = useLocale();
  const { toast } = useToast();
  const [packagesDialogOpen, setPackagesDialogOpen] = useState(false);
  const [shipmentsDialogOpen, setShipmentsDialogOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Receipt tracking state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [selectedLineItem, setSelectedLineItem] = useState<typeof order.line_items[0] | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  // Quotation approval state
  const [approveLoading, setApproveLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const isDraft = order.status?.toLowerCase() === 'draft';

  const handleApproveQuotation = async () => {
    setApproveLoading(true);
    try {
      const response = await fetch(`/api/orders/${order.salesorder_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        setApproved(true);
        toast({
          title: data.needsAdminApproval
            ? 'تمت الموافقة - بانتظار موافقة الإدارة'
            : 'تمت الموافقة وتأكيد الطلب',
          variant: 'default',
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        throw new Error(data.error || 'Failed to approve');
      }
    } catch (error) {
      toast({
        title: 'فشل في الموافقة على عرض السعر',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setApproveLoading(false);
    }
  };


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

  const baseStatusIndex = getStatusIndex(order.status);
  // Derive real progress from shipments/invoices (Odoo state alone stays 'confirmed')
  const currentStatusIndex = (() => {
    let idx = baseStatusIndex;
    if (idx < 0) return idx;
    if (invoices.length > 0) idx = Math.max(idx, 3);
    else if (shipments.some((s) => s.status === "delivered")) idx = Math.max(idx, 2);
    else if (
      shipments.length > 0 &&
      shipments.every((s) => ["ready", "ship", "deliver"].includes(s.fulfillment_stage || ""))
    ) idx = Math.max(idx, 1);
    return idx;
  })();
  const isCancelled = order.status?.toLowerCase() === "cancelled";

  const dateLocale = locale === "ar" ? "ar-IQ-u-nu-latn" : "en-US";
  const formatDate = (d?: string, style: "long" | "short" = "short") => {
    if (!d) return "";
    const datePart = d.split(" ")[0];
    const dt = new Date(`${datePart}T00:00:00`);
    if (isNaN(dt.getTime())) return datePart;
    return style === "long"
      ? dt.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : dt.toLocaleDateString(dateLocale, { day: "numeric", month: "long" });
  };

  const totalPieces = order.line_items?.reduce((sum, li) => sum + (li.quantity || 0), 0) || 0;

  // Clean product title: prefer the product display name; split the [sku] prefix into its own chip
  const cleanItem = (
    item: { item_name?: string; name?: string; description?: string },
    index: number
  ): { sku: string | null; title: string } => {
    const base = (item.item_name || item.name || item.description || `Item #${index + 1}`).trim();
    const m = base.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (m && m[2]) return { sku: m[1], title: m[2] };
    return { sku: null, title: base };
  };

  // Real timestamps per step (only shown when the step is completed and data exists)
  const stepDates: (string | null)[] = [
    order.date || null,
    null,
    shipments.find((s) => s.delivery_date)?.delivery_date || null,
    invoices[0]?.date || null,
  ];

  const FULFILLMENT_STAGES = [
    { key: "collect", label: t("stageCollect") },
    { key: "pack", label: t("stagePack") },
    { key: "ready", label: t("stageReady") },
    { key: "ship", label: t("stageShip") },
    { key: "deliver", label: t("stageDeliver") },
  ];

  const getShipmentBadge = (s: Shipment): { label: string; cls: string } => {
    if (s.status === "delivered") return { label: t("shipDelivered"), cls: "bg-green-500/10 text-green-400 border-green-500/30" };
    if (s.status === "cancelled") return { label: t("shipCancelled"), cls: "bg-red-500/10 text-red-400 border-red-500/30" };
    switch (s.fulfillment_stage) {
      case "collect": return { label: t("shipCollecting"), cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "pack": return { label: t("shipPacking"), cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      case "ready": return { label: t("shipReady"), cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "ship": return { label: t("shipInTransit"), cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
      case "deliver": return { label: t("shipDelivering"), cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
      default: return { label: t("shipPreparing"), cls: "bg-muted text-muted-foreground border-border" };
    }
  };

  const getInvoiceStatusCls = (status: string) => {
    if (status === "paid") return "bg-green-500/10 text-green-400 border-green-500/30";
    if (status === "partially_paid") return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    if (status === "overdue") return "bg-red-500/10 text-red-400 border-red-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const getStatusInfo = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusMap: Record<string, {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      color: string;
      bgColor: string;
    }> = {
      draft: { label: t("orderStatus.draft"), variant: "outline", color: "text-gray-300", bgColor: "bg-gray-500/15" },
      pending: { label: t("orderStatus.draft"), variant: "outline", color: "text-amber-400", bgColor: "bg-amber-500/15" },
      confirmed: { label: t("orderStatus.confirmed"), variant: "secondary", color: "text-blue-400", bgColor: "bg-blue-500/15" },
      open: { label: t("orderStatus.confirmed"), variant: "secondary", color: "text-blue-400", bgColor: "bg-blue-500/15" },
      packed: { label: t("orderStatus.packed"), variant: "secondary", color: "text-purple-400", bgColor: "bg-purple-500/15" },
      shipped: { label: t("orderStatus.shipped"), variant: "secondary", color: "text-indigo-400", bgColor: "bg-indigo-500/15" },
      delivered: { label: t("orderStatus.delivered"), variant: "default", color: "text-green-400", bgColor: "bg-green-500/15" },
      invoiced: { label: t("orderStatus.invoiced"), variant: "default", color: "text-emerald-400", bgColor: "bg-emerald-500/15" },
      cancelled: { label: t("orderStatus.cancelled"), variant: "destructive", color: "text-red-400", bgColor: "bg-red-500/15" },
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
    return `/api/images/${itemId}`;
  };

  const handleImageError = (itemId: string) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

  // Check if receipt tracking is enabled for this order
  const isReceiptTrackingEnabled = () => {
    const status = order.status?.toLowerCase();
    return status === 'shipped' || status === 'delivered';
  };

  // Handle receipt confirmation
  const handleReceiptConfirm = async (quantity: number) => {
    if (!selectedLineItem) return;

    setReceiptLoading(true);
    try {
      const response = await fetch(`/api/orders/${order.salesorder_id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItemId: selectedLineItem.line_item_id,
          quantityReceived: quantity,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: t('receipt.receiptSuccess'),
          variant: 'default',
        });
        // Refresh page to show updated data
        window.location.reload();
      } else {
        throw new Error(data.error || 'Failed to confirm receipt');
      }
    } catch (error) {
      console.error('Receipt confirmation error:', error);
      toast({
        title: t('receipt.receiptError'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setReceiptLoading(false);
    }
  };

  // Open receipt modal for a line item
  const openReceiptModal = (lineItem: typeof order.line_items[0]) => {
    setSelectedLineItem(lineItem);
    setReceiptModalOpen(true);
  };

  // Open timeline modal
  const openTimelineModal = () => {
    setTimelineModalOpen(true);
  };

  // Parse receipt timeline from order
  const getReceiptTimeline = (): ReceiptEvent[] => {
    if (!order.cf_receive_timeline) return [];
    try {
      return JSON.parse(order.cf_receive_timeline);
    } catch {
      return [];
    }
  };

  const statusInfo = getStatusInfo(order.status);
  const currency = order.currency_code || currencyCode;
  const receiptTrackingEnabled = isReceiptTrackingEnabled();
  const receiptTimeline = getReceiptTimeline();

  return (
    <div className="container mx-auto px-4 lg:px-6 py-6 max-w-[1840px]">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/orders">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
              </Button>
            </Link>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-3 rounded-xl ${statusInfo.bgColor} shrink-0`}>
                <FileText className={`h-5 w-5 ${statusInfo.color}`} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-3 flex-wrap">
                  <span dir="ltr">{order.salesorder_number}</span>
                  <Badge variant={statusInfo.variant} className="text-xs sm:text-sm px-3 py-1">
                    {statusInfo.label}
                  </Badge>
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDate(order.date, "long")}</span>
                  {(order.line_items?.length || 0) > 0 && (
                    <span className="hidden sm:inline">· {t("productsMeta", { count: order.line_items.length })}</span>
                  )}
                  {shipments.length > 0 && (
                    <span className="hidden sm:inline">· {t("shipmentsMeta", { count: shipments.length })}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
          <Link href={`/orders/${order.salesorder_id}/track`} className="shrink-0 self-start sm:self-auto">
            <Button className="gap-2">
              <MapPin className="h-4 w-4" />
              {t("trackOrder")}
            </Button>
          </Link>
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
                      {isCompleted && stepDates[index] && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDate(stepDates[index] || undefined)}
                        </span>
                      )}
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


        {/* Quotation Approval */}
        {isDraft && !approved && !isCancelled && (
          <Card className="border-amber-500/30 bg-amber-500/[0.07]">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-500/15">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-300">عرض سعر</p>
                  <p className="text-sm text-muted-foreground">هذا عرض سعر بانتظار موافقتك — وافق مباشرة أو افتح غرفة التفاوض للاعتراض على الأسعار أو تعديل البنود</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="default"
                  onClick={handleApproveQuotation}
                  disabled={approveLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {approveLoading ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  موافقة على عرض السعر
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 gap-2"
                >
                  <Link href={`/quotations/${order.salesorder_id}/negotiate`}>
                    <Handshake className="h-4 w-4" />
                    التفاوض على العرض
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {approved && (
          <Card className="border-green-500/30 bg-green-500/[0.07]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/15">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <p className="font-medium text-green-300">تمت الموافقة على عرض السعر</p>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:hidden">
          <Card className="bg-blue-500/[0.08] border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <ShoppingBag className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("total")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{formatCurrency(order.total)}</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-500/[0.08] border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <Package className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("items")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{order.line_items?.length || 0}</p>
            </CardContent>
          </Card>

          {packages.length > 0 && (
            <Card
              className="bg-amber-500/[0.08] border-amber-500/20 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setPackagesDialogOpen(true)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <PackageCheck className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t("packages")}</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{packages.length}</p>
              </CardContent>
            </Card>
          )}

          {shipments.length > 0 && (
            <Card
              className="bg-green-500/[0.08] border-green-500/20 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShipmentsDialogOpen(true)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Truck className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t("shipment")}</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{shipments.length}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Desktop: two-column layout — main content + sticky summary aside */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-6 min-w-0">

        {/* Line Items with Images */}
        {order.line_items && order.line_items.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
                  <Package className="h-5 w-5" />
                  {t("orderDetails")}
                  <span className="text-xs font-normal text-muted-foreground hidden lg:inline">
                    {t("productsMeta", { count: order.line_items.length })} · {t("piecesMeta", { count: totalPieces })}
                  </span>
                </CardTitle>
                {receiptTrackingEnabled && receiptTimeline.length > 0 && (
                  <Button variant="outline" size="sm" onClick={openTimelineModal}>
                    <Clock className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("receipt.viewTimeline")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {receiptTrackingEnabled && (
                <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="text-sm text-blue-300 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t("receipt.title")}
                  </p>
                </div>
              )}
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col />
                    <col className="w-[120px]" />
                    <col className="w-[84px]" />
                    <col className="w-[150px]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-start font-medium py-2.5 pe-4">{t("colProduct")}</th>
                      <th className="text-start font-medium py-2.5 px-2 whitespace-nowrap">{t("colUnitPrice")}</th>
                      <th className="text-start font-medium py-2.5 px-2">{t("colQty")}</th>
                      <th className="text-end font-medium py-2.5 ps-2 whitespace-nowrap">{t("colTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.line_items.map((item, index) => {
                      const dQuantityReceived = item.cf_quantity_received || 0;
                      const dIsFullyReceived = dQuantityReceived >= item.quantity;
                      const { sku: dSku, title: dTitle } = cleanItem(item, index);
                      return (
                        <Fragment key={`d-${item.line_item_id || index}`}>
                        <tr className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="py-3 pe-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-14 h-14 rounded-lg bg-muted shrink-0 overflow-hidden relative">
                                {!imageErrors[item.item_id] ? (
                                  <Image
                                    src={getItemImageUrl(item.item_id)}
                                    alt={dTitle}
                                    fill
                                    className="object-cover"
                                    onError={() => handleImageError(item.item_id)}
                                    sizes="56px"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Box className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                {item.item_id ? (
                                  <Link href={`/shop/${item.item_id}`} className="font-medium hover:text-primary hover:underline block truncate" dir="ltr">
                                    {dTitle}
                                  </Link>
                                ) : (
                                  <p className="font-medium truncate" dir="ltr">{dTitle}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {dSku && (
                                    <span dir="ltr" className="text-[10px] font-mono text-muted-foreground bg-muted/70 border border-border rounded px-1.5 py-px">{dSku}</span>
                                  )}
                                  {(item.discount ?? 0) > 0 && (
                                    <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30 bg-green-500/10">
                                      -{item.discount}% {t("discount")}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap text-foreground/80">
                            <span dir="ltr">{formatCurrency(item.rate, currency)}</span>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap">
                            <Badge variant="secondary" className="font-semibold">×{item.quantity}</Badge>
                          </td>
                          <td className="py-3 ps-2 whitespace-nowrap text-end font-bold text-[15px]">
                            <span dir="ltr">{formatCurrency(item.item_total, currency)}</span>
                          </td>
                        </tr>
                        {receiptTrackingEnabled && (
                          <tr className="border-b last:border-0">
                            <td colSpan={4} className="pb-3 pt-0 ps-14">
                              <div className="flex items-center gap-3 flex-wrap">
                                <ReceiptStatusBadge
                                  quantityOrdered={item.quantity}
                                  quantityReceived={dQuantityReceived}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-[160px] max-w-xs">
                                  <ReceiptProgressBar
                                    quantityOrdered={item.quantity}
                                    quantityReceived={dQuantityReceived}
                                    showLabel={false}
                                  />
                                </div>
                                {!dIsFullyReceived && (
                                  <Button size="sm" variant="outline" onClick={() => openReceiptModal(item)} className="text-xs">
                                    <CheckCircle2 className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                    {t("receipt.markAsReceived")}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-0 divide-y lg:hidden">
                {order.line_items.map((item, index) => {
                  const quantityReceived = item.cf_quantity_received || 0;
                  const isFullyReceived = quantityReceived >= item.quantity;
                  const { sku: mSku, title: mTitle } = cleanItem(item, index);

                  return (
                    <div
                      key={item.line_item_id || index}
                      className="py-4 first:pt-0 last:pb-0 space-y-3"
                    >
                      <div className="flex items-center gap-4">
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
                          <p className="font-medium text-sm sm:text-base truncate" dir="ltr">{mTitle}</p>
                          {mSku && (
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5" dir="ltr">{mSku}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs font-normal">
                              {item.quantity} × {formatCurrency(item.rate, currency)}
                            </Badge>
                            {(item.discount ?? 0) > 0 && (
                              <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 bg-green-500/10">
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

                      {/* Receipt Tracking Section */}
                      {receiptTrackingEnabled && (
                        <div className="pl-20 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <ReceiptStatusBadge
                              quantityOrdered={item.quantity}
                              quantityReceived={quantityReceived}
                              size="sm"
                            />
                            {!isFullyReceived && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReceiptModal(item)}
                                className="text-xs"
                              >
                                <CheckCircle2 className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                {t("receipt.markAsReceived")}
                              </Button>
                            )}
                          </div>
                          <ReceiptProgressBar
                            quantityOrdered={item.quantity}
                            quantityReceived={quantityReceived}
                            showLabel={true}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </CardContent>
          </Card>
        )}

        {/* Shipments — inline panel */}
        {shipments.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
                  <Truck className="h-5 w-5" />
                  {t("shipmentTitle")}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("shipmentsMeta", { count: shipments.length })}
                  </span>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShipmentsDialogOpen(true)}>
                  {t("viewDetails")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-0 divide-y">
                {shipments.map((shipment) => {
                  const badge = getShipmentBadge(shipment);
                  const stageIdx = FULFILLMENT_STAGES.findIndex((st) => st.key === shipment.fulfillment_stage);
                  return (
                    <div key={shipment.shipment_id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-muted shrink-0">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" dir="ltr">{shipment.shipment_number}</span>
                            <Badge variant="outline" className={`text-[11px] ${badge.cls}`}>{badge.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(shipment.package_count_actual || shipment.package_count || 0) > 0 && (
                              <span>{shipment.package_count_actual || shipment.package_count} {t("carton")} · </span>
                            )}
                            <span>{t("carrier")}: {shipment.carrier_name || shipment.carrier || t("notSpecified")}</span>
                          </p>
                        </div>
                      </div>
                      {shipment.fulfillment_stage && (
                        <div className="flex items-center gap-1 w-full sm:w-56 shrink-0">
                          {FULFILLMENT_STAGES.map((st, i) => {
                            const done = stageIdx >= 0 && i <= stageIdx;
                            const cur = i === stageIdx;
                            return (
                              <div key={st.key} className="flex-1 flex flex-col items-center gap-0.5">
                                <div className={`w-full h-1 rounded-full ${done ? (cur ? "bg-primary" : "bg-green-500") : "bg-muted"}`} />
                                <span className={`text-[9px] ${done ? (cur ? "text-primary font-semibold" : "text-green-400") : "text-muted-foreground"}`}>{st.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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

        </div>

        {/* Aside — sticky summary column */}
        <div className="space-y-6 lg:sticky lg:top-6">

          {/* Financial summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {t("financialSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span dir="ltr">{formatCurrency(order.sub_total || order.total, currency)}</span>
              </div>
              {order.tax_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("tax")}</span>
                  <span dir="ltr">{formatCurrency(order.tax_total, currency)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{t("discount")}</span>
                  <span dir="ltr">-{formatCurrency(order.discount, currency)}</span>
                </div>
              )}
              {order.shipping_charge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("shipping")}</span>
                  <span dir="ltr">{formatCurrency(order.shipping_charge, currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold pt-1">
                <span>{t("total")}</span>
                <span className="text-primary" dir="ltr">{formatCurrency(order.total, currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {tInv("title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {invoices.length > 0 ? (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <Link
                      key={inv.invoice_id}
                      href={`/invoices/${inv.invoice_id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" dir="ltr">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-sm font-bold" dir="ltr">{formatCurrency(inv.total, inv.currency_code)}</p>
                        <Badge variant="outline" className={`mt-0.5 text-[10px] ${getInvoiceStatusCls(inv.status)}`}>
                          {tInv(`invoiceStatus.${inv.status}`)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  {t("noInvoiceYet")}
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Link href={`/orders/${order.salesorder_id}/track`} className="block">
                <Button className="w-full gap-2 justify-center">
                  <MapPin className="h-4 w-4" />
                  {t("trackOrder")}
                </Button>
              </Link>
              <Link href="/shop" className="block">
                <Button variant="outline" className="w-full gap-2 justify-center">
                  <ShoppingBag className="h-4 w-4" />
                  {t("continueShopping")}
                </Button>
              </Link>
              <Link href="/orders" className="block">
                <Button variant="ghost" className="w-full gap-2 justify-center text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  {t("backToOrders")}
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>
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
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <Truck className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-300">{pkg.carrier}</span>
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
                    <div className="p-2 rounded-full bg-green-500/15">
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

                  {/* Handoff Info */}
                  {shipment.handoff_state === "handed_off" && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-green-300 text-sm font-semibold">
                        <Truck className="h-4 w-4" />
                        <span>تم التسليم للناقل</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {shipment.carrier_name && (
                          <div>
                            <span className="text-muted-foreground">الناقل: </span>
                            <span className="font-medium">{shipment.carrier_name}</span>
                          </div>
                        )}
                        {(shipment.package_count_actual ?? 0) > 0 && (
                          <div>
                            <span className="text-muted-foreground">البكجات: </span>
                            <span className="font-medium">📦 ×{shipment.package_count_actual}</span>
                          </div>
                        )}
                        {shipment.handoff_code && (
                          <div>
                            <span className="text-muted-foreground">كود التأكيد: </span>
                            <span className="font-mono font-medium text-primary">{shipment.handoff_code}</span>
                          </div>
                        )}
                        {shipment.receipt_number && (
                          <div>
                            <span className="text-muted-foreground">رقم الوصل: </span>
                            <span className="font-medium">{shipment.receipt_number}</span>
                          </div>
                        )}
                        {shipment.handoff_date && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">التاريخ: </span>
                            <span className="font-medium">{new Date(shipment.handoff_date).toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fulfillment Progress */}
                  {shipment.fulfillment_stage && (
                    <div className="flex items-center gap-1 pt-1">
                      {[
                        { key: "collect", label: "تجميع" },
                        { key: "pack", label: "تعبئة" },
                        { key: "ready", label: "جاهز" },
                        { key: "ship", label: "شحن" },
                        { key: "deliver", label: "تسليم" },
                      ].map((s, i, arr) => {
                        const idx = arr.findIndex(x => x.key === shipment.fulfillment_stage);
                        const done = i <= idx;
                        return (
                          <div key={s.key} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className={`w-full h-1 rounded-full ${done ? "bg-green-500" : "bg-muted"}`} />
                            <span className={`text-[9px] ${done ? "text-green-400" : "text-muted-foreground"}`}>{s.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

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

      {/* Receipt Confirmation Modal */}
      {selectedLineItem && (
        <ReceiptConfirmationModal
          open={receiptModalOpen}
          onOpenChange={setReceiptModalOpen}
          itemName={selectedLineItem.name || selectedLineItem.item_name || 'Item'}
          quantityOrdered={selectedLineItem.quantity}
          quantityReceived={selectedLineItem.cf_quantity_received || 0}
          onConfirm={handleReceiptConfirm}
          loading={receiptLoading}
        />
      )}

      {/* Receipt Timeline Modal */}
      <Dialog open={timelineModalOpen} onOpenChange={setTimelineModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {t("receipt.receiptTimeline")}
            </DialogTitle>
          </DialogHeader>
          <ReceiptTimeline
            events={receiptTimeline}
            quantityOrdered={order.line_items.reduce((sum, item) => sum + item.quantity, 0)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
