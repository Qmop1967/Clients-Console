import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Package,
  Box,
  ShoppingBag,
} from "lucide-react";
import { getInvoice } from "@/lib/zoho/invoices";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("invoices");
  return {
    title: `${t("invoiceNumber")} ${id.slice(-6)}`,
  };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("invoices");

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const invoice = await getInvoice(id, session.user.zohoContactId || "");

  if (!invoice) {
    notFound();
  }

  const formatCurrency = (amount: number, currency: string) => {
    const decimals = currency === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${currency}`
    );
  };

  const getStatusInfo = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusMap: Record<string, {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      icon: typeof CheckCircle2;
      color: string;
      bgColor: string;
    }> = {
      paid: {
        label: t("invoiceStatus.paid"),
        variant: "default",
        icon: CheckCircle2,
        color: "text-green-600",
        bgColor: "bg-green-50 dark:bg-green-900/20",
      },
      overdue: {
        label: t("invoiceStatus.overdue"),
        variant: "destructive",
        icon: AlertCircle,
        color: "text-red-600",
        bgColor: "bg-red-50 dark:bg-red-900/20",
      },
      partially_paid: {
        label: t("invoiceStatus.partially_paid"),
        variant: "secondary",
        icon: Clock,
        color: "text-amber-600",
        bgColor: "bg-amber-50 dark:bg-amber-900/20",
      },
      sent: {
        label: t("invoiceStatus.sent"),
        variant: "outline",
        icon: FileText,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
      },
      viewed: {
        label: t("invoiceStatus.viewed"),
        variant: "outline",
        icon: FileText,
        color: "text-purple-600",
        bgColor: "bg-purple-50 dark:bg-purple-900/20",
      },
      draft: {
        label: t("invoiceStatus.draft"),
        variant: "secondary",
        icon: FileText,
        color: "text-gray-600",
        bgColor: "bg-gray-50 dark:bg-gray-900/20",
      },
    };
    return statusMap[statusLower] || statusMap.draft;
  };

  const currency = invoice.currency_code || "USD";
  const statusInfo = getStatusInfo(invoice.status);

  // Calculate payment progress
  const paymentProgress = invoice.total > 0
    ? Math.round(((invoice.total - invoice.balance) / invoice.total) * 100)
    : 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/invoices">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${statusInfo.bgColor}`}>
                <Receipt className={`h-5 w-5 ${statusInfo.color}`} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {invoice.invoice_number}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("date")}: {invoice.date}
                </p>
              </div>
            </div>
          </div>
          <Badge variant={statusInfo.variant} className="text-sm px-4 py-1.5 self-start sm:self-auto">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("total")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">
                {formatCurrency(invoice.total, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${invoice.balance > 0 ? "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border-red-200/50" : "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50"}`}>
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 ${invoice.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"} mb-2`}>
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("balance")}</span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${invoice.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                {formatCurrency(invoice.balance, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200/50 col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("dueDate")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{invoice.due_date}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Progress (if partially paid) */}
        {invoice.balance > 0 && invoice.balance < invoice.total && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{t("paymentProgress")}</span>
                <span className="text-sm font-semibold text-primary">{paymentProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formatCurrency(invoice.total - invoice.balance, currency)} paid of {formatCurrency(invoice.total, currency)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        {invoice.line_items && invoice.line_items.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                Items ({invoice.line_items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-0 divide-y">
                {invoice.line_items.map((item, index) => (
                  <div
                    key={item.line_item_id || index}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Item Icon */}
                    <div className="w-12 h-12 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                      <Box className="h-5 w-5 text-muted-foreground" />
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
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice.sub_total || invoice.total, currency)}</span>
                </div>
                {invoice.tax_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(invoice.tax_total, currency)}</span>
                  </div>
                )}
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(invoice.discount, currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold pt-1">
                  <span>{t("total")}</span>
                  <span className="text-primary">{formatCurrency(invoice.total, currency)}</span>
                </div>
                {invoice.balance > 0 && (
                  <div className="flex justify-between font-semibold text-destructive">
                    <span>{t("balance")}</span>
                    <span>{formatCurrency(invoice.balance, currency)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/invoices">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("title")}
            </Button>
          </Link>
          {invoice.invoice_url && (
            <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                {t("downloadPdf")}
              </Button>
            </a>
          )}
          <Link href="/products">
            <Button variant="secondary" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
