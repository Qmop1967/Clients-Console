import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  FileCheck,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Box,
} from "lucide-react";
import { getCreditNote } from "@/lib/zoho/credit-notes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("creditNotes");
  return {
    title: `${t("creditNoteNumber")} ${id.slice(-6)}`,
  };
}

export default async function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("creditNotes");

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const creditNote = await getCreditNote(id, session.user.zohoContactId || "");

  if (!creditNote) {
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
      open: {
        label: t("status.open"),
        variant: "default",
        icon: CheckCircle2,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
      },
      closed: {
        label: t("status.closed"),
        variant: "secondary",
        icon: CheckCircle2,
        color: "text-green-600",
        bgColor: "bg-green-50 dark:bg-green-900/20",
      },
      void: {
        label: t("status.void"),
        variant: "destructive",
        icon: AlertCircle,
        color: "text-gray-600",
        bgColor: "bg-gray-50 dark:bg-gray-900/20",
      },
      draft: {
        label: t("status.draft"),
        variant: "outline",
        icon: Clock,
        color: "text-gray-600",
        bgColor: "bg-gray-50 dark:bg-gray-900/20",
      },
    };
    return statusMap[statusLower] || statusMap.draft;
  };

  const currency = creditNote.currency_code || "IQD";
  const statusInfo = getStatusInfo(creditNote.status);

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
              <div className={`p-3 rounded-xl ${statusInfo.bgColor}`}>
                <FileCheck className={`h-5 w-5 ${statusInfo.color}`} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {creditNote.creditnote_number}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("date")}: {creditNote.date}
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
                {formatCurrency(creditNote.total, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("balance")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                {formatCurrency(creditNote.balance, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200/50 col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t("date")}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{creditNote.date}</p>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        {creditNote.line_items && creditNote.line_items.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                {t("items")} ({creditNote.line_items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-0 divide-y">
                {creditNote.line_items.map((item, index) => (
                  <div
                    key={item.line_item_id || index}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Item Image */}
                    <div className="relative w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden">
                      {item.item_id ? (
                        <Image
                          src={`/api/zoho/images/${item.item_id}`}
                          alt={item.name || item.item_name || "Product"}
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Box className="h-5 w-5 text-muted-foreground" />
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
                <Separator />
                <div className="flex justify-between text-lg font-bold pt-1">
                  <span>{t("total")}</span>
                  <span className="text-blue-600">{formatCurrency(creditNote.total, currency)}</span>
                </div>
                {creditNote.balance > 0 && (
                  <div className="flex justify-between font-semibold text-green-600">
                    <span>{t("balance")}</span>
                    <span>{formatCurrency(creditNote.balance, currency)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {creditNote.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("notes")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{creditNote.notes}</p>
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
          <Link href="/credit-notes">
            <Button variant="secondary" className="gap-2">
              <FileCheck className="h-4 w-4" />
              {t("allCreditNotes")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
