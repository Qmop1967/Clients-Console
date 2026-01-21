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
  CreditCard,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  Receipt,
  Banknote,
} from "lucide-react";
import { getPayment } from "@/lib/zoho/payments";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("payments");
  return {
    title: `${t("paymentNumber")} ${id.slice(-6)}`,
  };
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("payments");

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const payment = await getPayment(id, session.user.zohoContactId || "");

  if (!payment) {
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

  const currency = payment.currency_code || "IQD";

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/account-statement">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
                <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {payment.payment_number}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("date")}: {payment.date}
                </p>
              </div>
            </div>
          </div>
          <Badge variant="default" className="text-sm px-4 py-1.5 self-start sm:self-auto bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {t("received")}
          </Badge>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("amount")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">
                {formatCurrency(payment.amount, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                <Banknote className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("paymentMode")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{payment.payment_mode || "N/A"}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("date")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{payment.date}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Details */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5" />
              {t("paymentDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="flex justify-between py-3 border-b">
                <span className="text-muted-foreground">{t("paymentNumber")}:</span>
                <span className="font-medium">{payment.payment_number}</span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-muted-foreground">{t("date")}:</span>
                <span className="font-medium">{payment.date}</span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-muted-foreground">{t("paymentMode")}:</span>
                <span className="font-medium">{payment.payment_mode || "N/A"}</span>
              </div>
              {payment.reference_number && (
                <div className="flex justify-between py-3 border-b">
                  <span className="text-muted-foreground">{t("reference")}:</span>
                  <span className="font-medium">{payment.reference_number}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold pt-1">
                <span>{t("amount")}</span>
                <span className="text-green-600 dark:text-green-400">{formatCurrency(payment.amount, currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applied to Invoices */}
        {payment.invoices && payment.invoices.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                {t("appliedToInvoices")} ({payment.invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-0 divide-y">
                {payment.invoices.map((invoice, index) => (
                  <div
                    key={invoice.invoice_id || index}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {invoice.invoice_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("invoiceDate")}: {invoice.date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(invoice.amount_applied, currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/account-statement">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("backToStatement")}
            </Button>
          </Link>
          <Link href="/payments">
            <Button variant="secondary" className="gap-2">
              <CreditCard className="h-4 w-4" />
              {t("allPayments")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
