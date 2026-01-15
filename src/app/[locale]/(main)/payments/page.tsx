import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { CreditCard, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCustomerPayments } from "@/lib/zoho/payments";
import type { ZohoPayment, PaginatedResponse } from "@/types";

// ISR: Revalidate every 60 seconds for fresher payment data
export const revalidate = 60;

export async function generateMetadata() {
  const t = await getTranslations("payments");
  return {
    title: t("title"),
  };
}

interface SearchParams {
  page?: string;
}

async function fetchPayments(
  zohoContactId: string | undefined,
  page: number = 1
): Promise<PaginatedResponse<ZohoPayment>> {
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
    return await getCustomerPayments(zohoContactId, page, 25);
  } catch (error) {
    console.error("Error fetching payments:", error);
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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const t = await getTranslations("payments");

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const currentPage = parseInt(params.page || "1", 10);
  const paymentsResponse = await fetchPayments(session.user.zohoContactId, currentPage);
  const payments = paymentsResponse.data;
  const pageContext = paymentsResponse.page_context;

  const currencyCode = session.user.currencyCode || "IQD";

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || currencyCode;
    // USD needs 2 decimal places, IQD typically uses 0
    const decimals = curr === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${curr}`
    );
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

        {payments.length === 0 ? (
          <div className="py-12 text-center">
            <CreditCard className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("noPayments")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <Link
                key={payment.payment_id}
                href={`/payments/${payment.payment_id}`}
                className="block"
              >
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="font-semibold">
                          {payment.payment_number}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {t("date")}: {payment.date}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{payment.payment_mode}</Badge>
                          {payment.reference_number && (
                            <span className="text-xs text-muted-foreground">
                              {t("reference")}: {payment.reference_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </p>
                        {payment.unused_amount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t("unusedAmount")}: {formatCurrency(payment.unused_amount)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Invoices applied to */}
                    {payment.invoices && payment.invoices.length > 0 && (
                      <div className="mt-3 rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">
                          {t("appliedTo")}: {payment.invoices.map(inv => inv.invoice_number).join(", ")}
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
              href={currentPage > 1 ? `/payments?page=${currentPage - 1}` : "#"}
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
              href={pageContext.has_more_page ? `/payments?page=${currentPage + 1}` : "#"}
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
