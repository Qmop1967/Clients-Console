import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Receipt, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCustomerCreditNotes, getAvailableCreditBalance } from "@/lib/zoho/credit-notes";
import type { ZohoCreditNote, PaginatedResponse } from "@/types";

export async function generateMetadata() {
  const t = await getTranslations("creditNotes");
  return {
    title: t("title"),
  };
}

interface SearchParams {
  page?: string;
}

async function fetchCreditNotes(
  zohoContactId: string | undefined,
  page: number = 1
): Promise<PaginatedResponse<ZohoCreditNote>> {
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
    return await getCustomerCreditNotes(zohoContactId, page, 25);
  } catch (error) {
    console.error("Error fetching credit notes:", error);
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

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const t = await getTranslations("creditNotes");

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const currentPage = parseInt(params.page || "1", 10);

  // Fetch credit notes and available balance in parallel
  const [creditNotesResponse, totalAvailableCredit] = await Promise.all([
    fetchCreditNotes(session.user.zohoContactId, currentPage),
    session.user.zohoContactId
      ? getAvailableCreditBalance(session.user.zohoContactId)
      : 0,
  ]);

  const creditNotes = creditNotesResponse.data;
  const pageContext = creditNotesResponse.page_context;

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
      case "open":
        return "outline";
      case "closed":
        return "default";
      case "void":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusLower = status?.toLowerCase() || "draft";
    const statusMap: Record<string, string> = {
      draft: t("creditNoteStatus.draft"),
      open: t("creditNoteStatus.open"),
      closed: t("creditNoteStatus.closed"),
      void: t("creditNoteStatus.void"),
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

        {/* Total Available Credit */}
        <Card className="bg-green-50 dark:bg-green-950">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalAvailable")}</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalAvailableCredit)}
            </p>
          </CardContent>
        </Card>

        {creditNotes.length === 0 ? (
          <div className="py-12 text-center">
            <Receipt className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("noCreditNotes")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {creditNotes.map((creditNote) => (
              <Link
                key={creditNote.creditnote_id}
                href={`/credit-notes/${creditNote.creditnote_id}`}
                className="block"
              >
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {creditNote.creditnote_number}
                          </span>
                          <Badge variant={getStatusVariant(creditNote.status)}>
                            {getStatusLabel(creditNote.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("date")}: {creditNote.date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(creditNote.total)}
                        </p>
                        {creditNote.balance > 0 && (
                          <p className="text-sm text-green-600">
                            {t("balance")}: {formatCurrency(creditNote.balance)}
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
              href={currentPage > 1 ? `/credit-notes?page=${currentPage - 1}` : "#"}
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
              href={pageContext.has_more_page ? `/credit-notes?page=${currentPage + 1}` : "#"}
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
