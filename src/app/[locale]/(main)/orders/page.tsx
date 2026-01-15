import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { OrdersContent } from "@/components/orders/orders-content";
import { getCustomerOrders, getOrderSummaryStats, type OrderSummaryStats } from "@/lib/zoho/orders";
import type { PaginatedResponse, ZohoSalesOrder } from "@/types";

// ISR: Revalidate every 60 seconds for fresher order data
export const revalidate = 60;

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

const EMPTY_PAGE_CONTEXT = {
  page: 1,
  per_page: 25,
  has_more_page: false,
  total: 0,
  total_pages: 0,
} as const;

const EMPTY_SUMMARY_STATS: OrderSummaryStats = {
  totalOrders: 0,
  totalAmount: 0,
  pendingCount: 0,
  pendingAmount: 0,
  confirmedCount: 0,
  confirmedAmount: 0,
  shippedCount: 0,
  shippedAmount: 0,
  deliveredCount: 0,
  deliveredAmount: 0,
  invoicedCount: 0,
  invoicedAmount: 0,
  cancelledCount: 0,
};

interface SearchParams {
  page?: string;
}

export default async function OrdersPage({
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
  const zohoContactId = session.user.zohoContactId;

  // Return empty state if no Zoho contact linked
  if (!zohoContactId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <OrdersContent
          customerId=""
          currencyCode={session.user.currencyCode || "IQD"}
          orders={[]}
          pageContext={EMPTY_PAGE_CONTEXT}
          currentPage={currentPage}
          summaryStats={EMPTY_SUMMARY_STATS}
        />
      </div>
    );
  }

  // Fetch orders and summary stats in parallel
  let ordersResponse: PaginatedResponse<ZohoSalesOrder> = { data: [], page_context: EMPTY_PAGE_CONTEXT };
  let summaryStats: OrderSummaryStats = EMPTY_SUMMARY_STATS;

  const results = await Promise.allSettled([
    getCustomerOrders(zohoContactId, currentPage, 25),
    getOrderSummaryStats(zohoContactId),
  ]);

  if (results[0].status === "fulfilled") {
    ordersResponse = results[0].value;
  } else {
    console.warn("Failed to fetch orders:", results[0].reason);
  }

  if (results[1].status === "fulfilled") {
    summaryStats = results[1].value;
  } else {
    console.warn("Failed to fetch order summary stats:", results[1].reason);
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <OrdersContent
        customerId={zohoContactId}
        currencyCode={session.user.currencyCode || "IQD"}
        orders={ordersResponse.data}
        pageContext={ordersResponse.page_context}
        currentPage={currentPage}
        summaryStats={summaryStats}
      />
    </div>
  );
}
