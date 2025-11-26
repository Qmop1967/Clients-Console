import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { FileText, Download, ChevronRight, ChevronLeft } from "lucide-react";
import { getCustomerInvoices } from "@/lib/zoho/invoices";
import type { ZohoInvoice, PaginatedResponse } from "@/types";

export async function generateMetadata() {
  const t = await getTranslations("invoices");
  return {
    title: t("title"),
  };
}

interface SearchParams {
  page?: string;
}

async function fetchInvoices(
  zohoContactId: string | undefined,
  page: number = 1
): Promise<PaginatedResponse<ZohoInvoice>> {
  if (!zohoContactId) {
    return {
      data: [],
      page_context: {
        page: 1,
        per_page: 25,
        has_more_page: false,
        total: 0,
        total_pages: 0,
      },
    };
  }

  try {
    return await getCustomerInvoices(zohoContactId, page, 25);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return {
      data: [],
      page_context: {
        page: 1,
        per_page: 25,
        has_more_page: false,
        total: 0,
        total_pages: 0,
      },
    };
  }
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const t = await getTranslations("invoices");

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const currentPage = parseInt(params.page || "1", 10);
  const invoicesResponse = await fetchInvoices(session.user.zohoContactId, currentPage);
  const invoices = invoicesResponse.data;
  const pageContext = invoicesResponse.page_context;

  const currencyCode = session.user.currencyCode || "IQD";

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
      case "paid":
        return "default";
      case "overdue":
        return "destructive";
      case "partially_paid":
        return "secondary";
      case "sent":
      case "viewed":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusMap: Record<string, string> = {
      draft: t("invoiceStatus.draft"),
      sent: t("invoiceStatus.sent"),
      viewed: t("invoiceStatus.viewed"),
      overdue: t("invoiceStatus.overdue"),
      partially_paid: t("invoiceStatus.partially_paid"),
      paid: t("invoiceStatus.paid"),
      void: t("invoiceStatus.void"),
    };
    return statusMap[statusLower] || status;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          {pageContext.total > 0 && (
            <p className="text-sm text-muted-foreground">
              {pageContext.total} {t("title").toLowerCase()}
            </p>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("noInvoices")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <Link
                key={invoice.invoice_id}
                href={`/invoices/${invoice.invoice_id}`}
                className="block"
              >
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {invoice.invoice_number}
                          </span>
                          <Badge variant={getStatusVariant(invoice.status)}>
                            {getStatusLabel(invoice.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("date")}: {invoice.date}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("dueDate")}: {invoice.due_date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(invoice.total)}
                        </p>
                        {invoice.balance > 0 && (
                          <p className="text-sm text-destructive">
                            {t("balance")}: {formatCurrency(invoice.balance)}
                          </p>
                        )}
                      </div>
                    </div>
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
              href={currentPage > 1 ? `/invoices?page=${currentPage - 1}` : "#"}
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
              href={pageContext.has_more_page ? `/invoices?page=${currentPage + 1}` : "#"}
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
    </div>
  );
}
