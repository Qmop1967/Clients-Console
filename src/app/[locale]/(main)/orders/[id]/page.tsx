import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getOrderWithDetails } from "@/lib/zoho/orders";
import { OrderDetailContent } from "@/components/orders/order-detail-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("orders");
  return {
    title: `${t("orderNumber")} ${id.slice(-6)}`,
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const customerId = session.user.zohoContactId || "";

  // Fetch order with packages and shipments in parallel
  const { order, packages, shipments } = await getOrderWithDetails(id, customerId);

  if (!order) {
    notFound();
  }

  return (
    <OrderDetailContent
      order={order}
      packages={packages}
      shipments={shipments}
      currencyCode={session.user.currencyCode || "IQD"}
    />
  );
}
