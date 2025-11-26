import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { OrdersContent } from "@/components/orders/orders-content";
import { OrdersSkeleton } from "@/components/orders/orders-skeleton";
import { getCustomerOrders } from "@/lib/zoho/orders";
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
  const ordersResponse = await fetchOrders(session.user.zohoContactId, currentPage);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersContent
          customerId={session.user.zohoContactId || ""}
          currencyCode={session.user.currencyCode || "IQD"}
          orders={ordersResponse.data}
          pageContext={ordersResponse.page_context}
          currentPage={currentPage}
        />
      </Suspense>
    </div>
  );
}
