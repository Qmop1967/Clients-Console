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
    // USD needs 2 decimal places, IQD typically uses 0
    const decimals = currency === "IQD" ? 0 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
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
      {/* Welcome Section - Luxury styling */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t("welcome", { name: userName || "Guest" })}
        </h1>
        <p className="text-muted-foreground">
          {zohoContactId
            ? t("accountLinked")
            : t("completeProfile")}
        </p>
      </div>

      {/* Stats Grid - Premium cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Outstanding Balance Card */}
        <Card variant="elevated" className="relative overflow-hidden">
          <div className="absolute end-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-red-500/10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("outstandingBalance")}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="price-display text-red-600 dark:text-red-400">
              {formatCurrency(balance?.outstanding || 0, displayCurrency)}
            </div>
          </CardContent>
        </Card>

        {/* Unused Credits Card */}
        <Card variant="elevated" className="relative overflow-hidden">
          <div className="absolute end-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-500/10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("unusedCredits")}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="price-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(balance?.unused_credits || 0, displayCurrency)}
            </div>
          </CardContent>
        </Card>

        {/* Total Orders Card */}
        <Card variant="elevated" className="relative overflow-hidden">
          <div className="absolute end-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalOrders")}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-semibold">{orderStats.total ?? 0}</div>
          </CardContent>
        </Card>

        {/* Pending Orders Card */}
        <Card variant="elevated" className="relative overflow-hidden">
          <div className="absolute end-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-amber-500/10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("pendingOrders")}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-semibold text-amber-600 dark:text-amber-400">
              {orderStats.pending ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Not Linked Warning */}
      {!zohoContactId && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {t("accountNotLinked")}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t("contactSupportToLink")}
              </p>
            </div>
            <Link href="/support">
              <Button size="sm" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50">
                {t("contactSupport")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

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
                <Link href="/products" className="mt-3">
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
