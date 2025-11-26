"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ChevronRight, Package, RefreshCw, ChevronLeft } from "lucide-react";
import type { ZohoSalesOrder } from "@/types";

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
}

export function OrdersContent({
  customerId,
  currencyCode,
  orders,
  pageContext,
  currentPage,
}: OrdersContentProps) {
  const t = useTranslations("orders");

  const formatCurrency = (amount: number) => {
    return (
      new Intl.NumberFormat("en-IQ", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount) + ` ${currencyCode}`
    );
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "default";
      case "shipped":
        return "secondary";
      case "confirmed":
      case "open":
        return "outline";
      case "packed":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusMap: Record<string, string> = {
      draft: t("orderStatus.draft"),
      confirmed: t("orderStatus.confirmed"),
      open: t("orderStatus.confirmed"),
      packed: t("orderStatus.packed"),
      shipped: t("orderStatus.shipped"),
      delivered: t("orderStatus.delivered"),
      cancelled: t("orderStatus.cancelled"),
    };
    return statusMap[statusLower] || status;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {pageContext.total > 0 && (
          <p className="text-sm text-muted-foreground">
            {pageContext.total} {t("title").toLowerCase()}
          </p>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t("noOrders")}</p>
          <Link href="/shop" className="mt-4 inline-block">
            <Button>{t("startShopping")}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.salesorder_id}
              href={`/orders/${order.salesorder_id}`}
              className="block"
            >
              <Card className="overflow-hidden hover:bg-muted/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {order.salesorder_number}
                        </span>
                        <Badge variant={getStatusVariant(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.date}
                      </p>
                      {order.line_items && order.line_items.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {order.line_items.length} {t("items")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(order.total)}
                      </p>
                      {order.delivery_date && (
                        <p className="text-xs text-muted-foreground">
                          {t("deliveryDate")}: {order.delivery_date}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items preview */}
                  {order.line_items && order.line_items.length > 0 && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {order.line_items
                          .slice(0, 3)
                          .map((item) => `${item.item_name} x${item.quantity}`)
                          .join(", ")}
                        {order.line_items.length > 3 && ` +${order.line_items.length - 3} more`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageContext.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Link
            href={currentPage > 1 ? `/orders?page=${currentPage - 1}` : "#"}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            <Button variant="outline" size="sm" disabled={currentPage <= 1}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("previous")}
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground px-4">
            {t("page")} {currentPage} / {pageContext.total_pages}
          </span>
          <Link
            href={pageContext.has_more_page ? `/orders?page=${currentPage + 1}` : "#"}
            className={!pageContext.has_more_page ? "pointer-events-none opacity-50" : ""}
          >
            <Button variant="outline" size="sm" disabled={!pageContext.has_more_page}>
              {t("next")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
