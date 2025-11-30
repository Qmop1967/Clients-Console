"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Package,
  Search,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  X,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  PackageCheck,
  ArrowRight,
} from "lucide-react";
import type { ZohoSalesOrder } from "@/types";
import type { OrderSummaryStats } from "@/lib/zoho/orders";

interface PageContext {
  page: number;
  per_page: number;
  has_more_page: boolean;
  total: number;
  total_pages: number;
}

interface OrdersContentProps {
  customerId: string;
  currencyCode: string;
  orders: ZohoSalesOrder[];
  pageContext: PageContext;
  currentPage: number;
  summaryStats: OrderSummaryStats;
}

type StatusFilter = "all" | "pending" | "confirmed" | "shipped" | "invoiced";

export function OrdersContent({
  currencyCode,
  orders,
  pageContext,
  currentPage,
  summaryStats,
}: OrdersContentProps) {
  const t = useTranslations("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || currencyCode;
    const decimals = curr === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${curr}`
    );
  };

  const getStatusInfo = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusMap: Record<string, {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      color: string;
      bgColor: string;
      icon: React.ReactNode;
    }> = {
      draft: {
        label: t("orderStatus.draft"),
        variant: "outline",
        color: "text-gray-600 dark:text-gray-400",
        bgColor: "bg-gray-100 dark:bg-gray-800",
        icon: <Clock className="h-3.5 w-3.5" />,
      },
      pending: {
        label: t("orderStatus.draft"),
        variant: "outline",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-900/20",
        icon: <Clock className="h-3.5 w-3.5" />,
      },
      confirmed: {
        label: t("orderStatus.confirmed"),
        variant: "secondary",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      },
      open: {
        label: t("orderStatus.confirmed"),
        variant: "secondary",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      },
      packed: {
        label: t("orderStatus.packed"),
        variant: "secondary",
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-50 dark:bg-purple-900/20",
        icon: <PackageCheck className="h-3.5 w-3.5" />,
      },
      shipped: {
        label: t("orderStatus.shipped"),
        variant: "secondary",
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
        icon: <Truck className="h-3.5 w-3.5" />,
      },
      delivered: {
        label: t("orderStatus.delivered"),
        variant: "default",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-900/20",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      },
      invoiced: {
        label: t("orderStatus.invoiced"),
        variant: "default",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
        icon: <FileText className="h-3.5 w-3.5" />,
      },
      cancelled: {
        label: t("orderStatus.cancelled"),
        variant: "destructive",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        icon: <X className="h-3.5 w-3.5" />,
      },
    };
    return statusMap[statusLower] || statusMap.draft;
  };

  // Filter orders based on search and status
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (order) =>
          order.salesorder_number?.toLowerCase().includes(query) ||
          order.reference_number?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((order) => {
        const status = order.status?.toLowerCase() || "draft";
        switch (statusFilter) {
          case "pending":
            return status === "draft" || status === "pending";
          case "confirmed":
            return status === "confirmed" || status === "open";
          case "shipped":
            return status === "packed" || status === "shipped" || status === "delivered";
          case "invoiced":
            return status === "invoiced";
          default:
            return true;
        }
      });
    }

    return result;
  }, [orders, searchQuery, statusFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all";

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const totalPages = pageContext.total_pages;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  // Summary cards data
  const summaryCards = [
    {
      title: t("totalOrders"),
      value: summaryStats.totalOrders,
      amount: formatCurrency(summaryStats.totalAmount),
      icon: <ShoppingBag className="h-5 w-5" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      filter: "all" as StatusFilter,
    },
    {
      title: t("pendingOrders"),
      value: summaryStats.pendingCount + summaryStats.confirmedCount,
      amount: formatCurrency(summaryStats.pendingAmount + summaryStats.confirmedAmount),
      icon: <Clock className="h-5 w-5" />,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      filter: "pending" as StatusFilter,
    },
    {
      title: t("inProgress"),
      value: summaryStats.shippedCount + summaryStats.deliveredCount,
      amount: formatCurrency(summaryStats.shippedAmount + summaryStats.deliveredAmount),
      icon: <Truck className="h-5 w-5" />,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
      filter: "shipped" as StatusFilter,
    },
    {
      title: t("invoicedOrders"),
      value: summaryStats.invoicedCount,
      amount: formatCurrency(summaryStats.invoicedAmount),
      icon: <FileText className="h-5 w-5" />,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
      filter: "invoiced" as StatusFilter,
    },
  ];

  const statusTabs = [
    { key: "all" as StatusFilter, label: t("filterAll"), count: summaryStats.totalOrders },
    { key: "pending" as StatusFilter, label: t("filterPending"), count: summaryStats.pendingCount + summaryStats.confirmedCount },
    { key: "shipped" as StatusFilter, label: t("filterShipped"), count: summaryStats.shippedCount + summaryStats.deliveredCount },
    { key: "invoiced" as StatusFilter, label: t("filterInvoiced"), count: summaryStats.invoicedCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header - Luxury styling */}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>
        {pageContext.total > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("showing", {
              from: (currentPage - 1) * pageContext.per_page + 1,
              to: Math.min(currentPage * pageContext.per_page, pageContext.total),
              total: pageContext.total,
            })}
          </p>
        )}
      </div>

      {/* Summary Cards - Premium elevated cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            variant="elevated"
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden ${
              statusFilter === card.filter ? "ring-2 ring-amber-500/50" : ""
            }`}
            onClick={() => setStatusFilter(card.filter)}
          >
            <div className={`absolute end-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full ${card.bgColor} opacity-50`} />
            <CardContent className="p-4 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {card.title}
                  </p>
                  <p className="font-display text-2xl font-semibold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.amount}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bgColor}`}>
                  <span className={card.color}>{card.icon}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search - Premium styling */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="premium"
            className="ps-10 h-11"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute end-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Status Tabs - Premium styling */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={statusFilter === tab.key ? "gold" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(tab.key)}
              className="gap-1.5 transition-all"
            >
              {tab.label}
              <Badge
                variant={statusFilter === tab.key ? "gold-subtle" : "outline"}
                className="ms-1 h-5 px-1.5 text-xs"
              >
                {tab.count}
              </Badge>
            </Button>
          ))}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4 me-1" />
              {t("clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card variant="elevated" className="py-12">
          <CardContent className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Package className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">
              {hasActiveFilters ? t("noFilterResults") : t("noOrders")}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {hasActiveFilters
                ? t("noFilterResultsDescription")
                : t("noOrdersDescription")}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            ) : (
              <Link href="/products">
                <Button variant="gold">{t("startShopping")}</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusInfo = getStatusInfo(order.status);
            return (
              <Link
                key={order.salesorder_id}
                href={`/orders/${order.salesorder_id}`}
                className="block group"
              >
                <Card variant="interactive" className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-amber-500/30">
                  <CardContent className="p-0">
                    {/* Desktop View */}
                    <div className="hidden md:block">
                      <div className="p-4 flex items-center gap-4">
                        {/* Status Icon */}
                        <div className={`p-3 rounded-lg ${statusInfo.bgColor} shrink-0`}>
                          <span className={statusInfo.color}>{statusInfo.icon}</span>
                        </div>

                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-display font-semibold text-base">
                              {order.salesorder_number}
                            </span>
                            <Badge
                              variant={statusInfo.variant}
                              className="shrink-0"
                            >
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {order.date}
                            </span>
                            {order.line_items && order.line_items.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Package className="h-3.5 w-3.5" />
                                {order.line_items.length} {t("items")}
                              </span>
                            )}
                            {order.delivery_date && (
                              <span className="flex items-center gap-1">
                                <Truck className="h-3.5 w-3.5" />
                                {t("deliveryDate")}: {order.delivery_date}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount & Action */}
                        <div className="text-right shrink-0">
                          <p className="price-display text-lg mb-1">
                            {formatCurrency(order.total, order.currency_code)}
                          </p>
                          <div className="flex items-center text-sm text-amber-600 dark:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {t("viewOrder")}
                            <ArrowRight className="h-4 w-4 ms-1" />
                          </div>
                        </div>
                      </div>

                      {/* Items Preview */}
                      {order.line_items && order.line_items.length > 0 && (
                        <div className="px-4 pb-4">
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {order.line_items
                                .slice(0, 4)
                                .map((item) => `${item.item_name} ×${item.quantity}`)
                                .join(" • ")}
                              {order.line_items.length > 4 && (
                                <span className="text-primary ml-1">
                                  +{order.line_items.length - 4} {t("moreItems")}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${statusInfo.bgColor}`}>
                            <span className={statusInfo.color}>{statusInfo.icon}</span>
                          </div>
                          <div>
                            <span className="font-display font-semibold block">
                              {order.salesorder_number}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {order.date}
                            </span>
                          </div>
                        </div>
                        <Badge variant={statusInfo.variant} className="shrink-0">
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {order.line_items && order.line_items.length > 0 && (
                        <div className="rounded-lg bg-muted/50 p-2.5">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {order.line_items
                              .slice(0, 3)
                              .map((item) => `${item.item_name} ×${item.quantity}`)
                              .join(", ")}
                            {order.line_items.length > 3 && ` +${order.line_items.length - 3}`}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Package className="h-3.5 w-3.5" />
                          {order.line_items?.length || 0} {t("items")}
                        </div>
                        <p className="price-tag font-bold">
                          {formatCurrency(order.total, order.currency_code)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pageContext.total_pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <p className="text-sm text-muted-foreground order-2 sm:order-1">
            {t("page")} {currentPage} {t("of")} {pageContext.total_pages}
          </p>

          <div className="flex items-center gap-1 order-1 sm:order-2">
            {/* First Page */}
            <Link
              href={currentPage > 1 ? `/orders?page=1` : "#"}
              className={currentPage <= 1 ? "pointer-events-none" : ""}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={currentPage <= 1}
                title={t("firstPage")}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </Link>

            {/* Previous */}
            <Link
              href={currentPage > 1 ? `/orders?page=${currentPage - 1}` : "#"}
              className={currentPage <= 1 ? "pointer-events-none" : ""}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>

            {/* Page Numbers */}
            <div className="hidden sm:flex items-center gap-1">
              {getPageNumbers().map((pageNum, idx) =>
                pageNum === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <Link key={pageNum} href={`/orders?page=${pageNum}`}>
                    <Button
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="icon"
                      className="h-9 w-9"
                    >
                      {pageNum}
                    </Button>
                  </Link>
                )
              )}
            </div>

            {/* Mobile Page Indicator */}
            <span className="sm:hidden px-3 text-sm font-medium">
              {currentPage} / {pageContext.total_pages}
            </span>

            {/* Next */}
            <Link
              href={pageContext.has_more_page ? `/orders?page=${currentPage + 1}` : "#"}
              className={!pageContext.has_more_page ? "pointer-events-none" : ""}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={!pageContext.has_more_page}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>

            {/* Last Page */}
            <Link
              href={currentPage < pageContext.total_pages ? `/orders?page=${pageContext.total_pages}` : "#"}
              className={currentPage >= pageContext.total_pages ? "pointer-events-none" : ""}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={currentPage >= pageContext.total_pages}
                title={t("lastPage")}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
