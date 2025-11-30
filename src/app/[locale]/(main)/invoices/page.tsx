import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getCustomerInvoices, getInvoiceSummaryStats, type InvoiceSummaryStats } from "@/lib/zoho/invoices";
import { InvoicesContent } from "@/components/invoices/invoices-content";
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

async function fetchSummaryStats(
  zohoContactId: string | undefined
): Promise<InvoiceSummaryStats | null> {
  if (!zohoContactId) {
    return null;
  }

  try {
    return await getInvoiceSummaryStats(zohoContactId);
  } catch (error) {
    console.error("Error fetching invoice summary:", error);
    return null;
  }
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const currentPage = parseInt(params.page || "1", 10);

  // Fetch both invoices for current page and overall summary stats in parallel
  const [invoicesResponse, summaryStats] = await Promise.all([
    fetchInvoices(session.user.zohoContactId, currentPage),
    fetchSummaryStats(session.user.zohoContactId),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      <InvoicesContent
        invoices={invoicesResponse.data}
        pageContext={invoicesResponse.page_context}
        currentPage={currentPage}
        currencyCode={session.user.currencyCode || "USD"}
        summaryStats={summaryStats}
      />
    </div>
  );
}
