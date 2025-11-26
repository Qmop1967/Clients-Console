import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { getCustomerBalance } from "@/lib/zoho/customers";
import { getRecentOrders, getOrderStats } from "@/lib/zoho/orders";
import { getRecentInvoices } from "@/lib/zoho/invoices";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return {
    title: t("title"),
  };
}

async function fetchDashboardData(zohoContactId: string | undefined) {
  if (!zohoContactId) {
    return {
      balance: null,
      orderStats: { total: 0, pending: 0, confirmed: 0, shipped: 0, delivered: 0 },
      recentOrders: [],
      recentInvoices: [],
    };
  }

  try {
    // Fetch all data in parallel for efficiency
    const [balance, orderStats, recentOrders, recentInvoices] = await Promise.all([
      getCustomerBalance(zohoContactId),
      getOrderStats(zohoContactId),
      getRecentOrders(zohoContactId, 5),
      getRecentInvoices(zohoContactId, 5),
    ]);

    return {
      balance,
      orderStats,
      recentOrders,
      recentInvoices,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return {
      balance: null,
      orderStats: { total: 0, pending: 0, confirmed: 0, shipped: 0, delivered: 0 },
      recentOrders: [],
      recentInvoices: [],
    };
  }
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const dashboardData = await fetchDashboardData(session.user.zohoContactId);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          userId={session.user.id}
          zohoContactId={session.user.zohoContactId}
          userName={session.user.name}
          currencyCode={session.user.currencyCode || "IQD"}
          balance={dashboardData.balance}
          orderStats={dashboardData.orderStats}
          recentOrders={dashboardData.recentOrders}
          recentInvoices={dashboardData.recentInvoices}
        />
      </Suspense>
    </div>
  );
}
