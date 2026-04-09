import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { getCustomerBalance, getCustomerFresh } from "@/lib/odoo/customers";
import { getRecentOrders, getOrderStats } from "@/lib/odoo/orders";
import { getRecentInvoices } from "@/lib/odoo/invoices";

// PERFORMANCE: Use ISR with short revalidation for balance between freshness and speed
// Dashboard data is cached for 60 seconds - fresh enough for B2B use case
// This dramatically improves TTFB and LCP by serving from edge cache
export const revalidate = 60; // 1 minute ISR

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return {
    title: t("title"),
  };
}

// Separate async component for dashboard data - enables streaming
async function DashboardDataLoader({
  userId,
  odooPartnerId,
  userName,
  currencyCode,
}: {
  userId: string;
  odooPartnerId: string | undefined;
  userName: string | null | undefined;
  currencyCode: string;
}) {
  if (!odooPartnerId) {
    return (
      <DashboardContent
        userId={userId}
        odooPartnerId={odooPartnerId}
        userName={userName}
        currencyCode={currencyCode}
        balance={null}
        orderStats={{ total: 0, pending: 0, confirmed: 0, shipped: 0, delivered: 0 }}
        recentOrders={[]}
        recentInvoices={[]}
      />
    );
  }

  try {
    // Fetch all data in parallel for efficiency
    const [balance, orderStats, recentOrders, recentInvoices] = await Promise.all([
      getCustomerBalance(odooPartnerId),
      getOrderStats(odooPartnerId),
      getRecentOrders(odooPartnerId, 5),
      getRecentInvoices(odooPartnerId, 5),
    ]);

    return (
      <DashboardContent
        userId={userId}
        odooPartnerId={odooPartnerId}
        userName={userName}
        currencyCode={currencyCode}
        balance={balance}
        orderStats={orderStats}
        recentOrders={recentOrders}
        recentInvoices={recentInvoices}
      />
    );
  } catch (error) {
    console.error("[Dashboard] Error fetching dashboard data:", error);
    return (
      <DashboardContent
        userId={userId}
        odooPartnerId={odooPartnerId}
        userName={userName}
        currencyCode={currencyCode}
        balance={null}
        orderStats={{ total: 0, pending: 0, confirmed: 0, shipped: 0, delivered: 0 }}
        recentOrders={[]}
        recentInvoices={[]}
      />
    );
  }
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // CRITICAL: Fetch fresh customer data to get current currency
  // Session may have stale currency if customer's price list was changed in the system
  let currencyCode = session.user.currencyCode || "IQD";

  let userName = session.user.name;

  if (session.user.odooPartnerId) {
    try {
      const freshCustomer = await getCustomerFresh(session.user.odooPartnerId);
      if (freshCustomer?.currency_code) {
        currencyCode = freshCustomer.currency_code;
      }
      if (freshCustomer?.contact_name && (!session.user.name || session.user.name === 'General' || session.user.name === 'Guest')) {
        // Use Odoo name instead of session name
        userName = freshCustomer.contact_name;
      }
    } catch {
      // Fall back to session data
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Suspense enables streaming - skeleton shows immediately while data loads */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardDataLoader
          userId={session.user.id}
          odooPartnerId={session.user.odooPartnerId}
          userName={userName}
          currencyCode={currencyCode}
        />
      </Suspense>
    </div>
  );
}
