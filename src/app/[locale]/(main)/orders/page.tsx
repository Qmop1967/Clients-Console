import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { OrdersContent } from "@/components/orders/orders-content";
import { OrdersSkeleton } from "@/components/orders/orders-skeleton";
import { getCustomerOrders, getOrderSummaryStats, type OrderSummaryStats } from "@/lib/zoho/orders";
import type { ZohoSalesOrder, PaginatedResponse } from "@/types";

export async function generateMetadata() {
  const t = await getTranslations("orders");
  return {
    title: t("title"),
  };
}

interface SearchParams {
  page?: string;
}

async function fetchOrders(
  zohoContactId: string | undefined,
  page: number = 1
): Promise<PaginatedResponse<ZohoSalesOrder>> {
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
    return await getCustomerOrders(zohoContactId, page, 25);
  } catch (error) {
    console.error("Error fetching orders:", error);
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
): Promise<OrderSummaryStats> {
  if (!zohoContactId) {
    return {
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
  }

  try {
    return await getOrderSummaryStats(zohoContactId);
  } catch (error) {
    console.error("Error fetching order summary stats:", error);
    return {
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
  }
}

export default async function OrdersPage({
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

  // Fetch orders and summary stats in parallel
  const [ordersResponse, summaryStats] = await Promise.all([
    fetchOrders(session.user.zohoContactId, currentPage),
    fetchSummaryStats(session.user.zohoContactId),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersContent
          customerId={session.user.zohoContactId || ""}
          currencyCode={session.user.currencyCode || "IQD"}
          orders={ordersResponse.data}
          pageContext={ordersResponse.page_context}
          currentPage={currentPage}
          summaryStats={summaryStats}
        />
      </Suspense>
    </div>
  );
}
