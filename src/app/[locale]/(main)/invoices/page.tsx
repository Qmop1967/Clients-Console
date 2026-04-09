import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getCustomerInvoices, getInvoiceSummaryStats, type InvoiceSummaryStats } from "@/lib/odoo/invoices";
import { InvoicesContent } from "@/components/invoices/invoices-content";
import type { PaginatedResponse, Invoice } from "@/types";

// ISR: Revalidate every 60 seconds for fresher invoice data
export const revalidate = 60;

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations("invoices");
  return { title: t("title") };
}

const EMPTY_PAGE_CONTEXT = {
  page: 1,
  per_page: 25,
  has_more_page: false,
  total: 0,
  total_pages: 0,
} as const;

interface SearchParams {
  page?: string;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const currentPage = parseInt(params.page || "1", 10);
  const odooPartnerId = session.user.odooPartnerId;

  // Return empty state if no contact linked
  if (!odooPartnerId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <InvoicesContent
          invoices={[]}
          pageContext={EMPTY_PAGE_CONTEXT}
          currentPage={currentPage}
          currencyCode={session.user.currencyCode || "IQD"}
          summaryStats={null}
        />
      </div>
    );
  }

  // Fetch invoices and summary stats in parallel
  let invoicesResponse: PaginatedResponse<Invoice> = { data: [], page_context: EMPTY_PAGE_CONTEXT };
  let summaryStats: InvoiceSummaryStats | null = null;

  const results = await Promise.allSettled([
    getCustomerInvoices(odooPartnerId, currentPage, 25),
    getInvoiceSummaryStats(odooPartnerId),
  ]);

  if (results[0].status === "fulfilled") {
    invoicesResponse = results[0].value;
  } else {
    console.warn("Failed to fetch invoices:", results[0].reason);
  }

  if (results[1].status === "fulfilled") {
    summaryStats = results[1].value;
  } else {
    console.warn("Failed to fetch invoice summary stats:", results[1].reason);
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <InvoicesContent
        invoices={invoicesResponse.data}
        pageContext={invoicesResponse.page_context}
        currentPage={currentPage}
        currencyCode={session.user.currencyCode || "IQD"}
        summaryStats={summaryStats}
      />
    </div>
  );
}
