"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import {
  DollarSign,
  CreditCard,
  ShoppingBag,
  Clock,
  ArrowRight,
  Package,
  FileText,
  HeadphonesIcon,
  AlertCircle,
} from "lucide-react";
import type { ZohoSalesOrder, ZohoInvoice } from "@/types";

interface CustomerBalance {
  outstanding: number;
  unused_credits: number;
  currency_code: string;
}

interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
}

interface DashboardContentProps {
  userId: string;
  zohoContactId?: string;
  userName?: string | null;
  currencyCode: string;
  balance: CustomerBalance | null;
  orderStats: OrderStats;
  recentOrders: ZohoSalesOrder[];
  recentInvoices: ZohoInvoice[];
}

export function DashboardContent({
  userId,
  zohoContactId,
  userName,
  currencyCode,
  balance,
  orderStats,
  recentOrders,
  recentInvoices,
}: DashboardContentProps) {
  const t = useTranslations("dashboard");

  // Use currency from balance or fallback to prop
  const displayCurrency = balance?.currency_code || currencyCode;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-IQ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ` ${currency}`;
  };

  const getOrderStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "delivered":
        return "default";
      case "shipped":
        return "secondary";
      case "confirmed":
      case "open":
        return "outline";
      case "draft":
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getInvoiceStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "paid":
        return "default";
      case "partially_paid":
        return "secondary";
      case "sent":
      case "viewed":
        return "outline";
      case "overdue":
        return "destructive";
      case "draft":
      case "void":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold">
          {t("welcome", { name: userName || "Guest" })}
        </h1>
        <p className="text-muted-foreground">
          {zohoContactId
            ? t("accountLinked")
            : t("completeProfile")}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("outstandingBalance")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(balance?.outstanding || 0, displayCurrency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("unusedCredits")}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(balance?.unused_credits || 0, displayCurrency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalOrders")}
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("pendingOrders")}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {orderStats.pending}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t("quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/products">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Package className="h-4 w-4" />
                {t("placeOrder")}
              </Button>
            </Link>
            <Link href="/account-statement">
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                {t("viewStatement")}
              </Button>
            </Link>
            <Link href="/support">
              <Button variant="outline" className="w-full justify-start gap-2">
                <HeadphonesIcon className="h-4 w-4" />
                {t("contactSupport")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders & Invoices Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("recentOrders")}</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="gap-1">
                {t("viewAll")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
                <Link href="/shop" className="mt-3">
                  <Button size="sm">{t("startShopping")}</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.salesorder_id}
                    href={`/orders/${order.salesorder_id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-medium">{order.salesorder_number}</p>
                        <p className="text-sm text-muted-foreground">{order.date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getOrderStatusColor(order.status) as "default" | "secondary" | "destructive" | "outline"}>
                          {order.status}
                        </Badge>
                        <span className="font-medium text-sm">
                          {formatCurrency(order.total, order.currency_code || displayCurrency)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("recentInvoices")}</CardTitle>
            <Link href="/invoices">
              <Button variant="ghost" size="sm" className="gap-1">
                {t("viewAll")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <Link
                    key={invoice.invoice_id}
                    href={`/invoices/${invoice.invoice_id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("dueDate")}: {invoice.due_date}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getInvoiceStatusColor(invoice.status) as "default" | "secondary" | "destructive" | "outline"}>
                          {invoice.status}
                        </Badge>
                        <div className="text-right">
                          <span className="font-medium text-sm block">
                            {formatCurrency(invoice.total, invoice.currency_code || displayCurrency)}
                          </span>
                          {invoice.balance > 0 && (
                            <span className="text-xs text-destructive">
                              {t("balance")}: {formatCurrency(invoice.balance, invoice.currency_code || displayCurrency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
