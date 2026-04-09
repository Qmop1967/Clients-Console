import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getOrderWithDetails } from "@/lib/odoo/orders";
import { OrderTrackingContent } from "@/components/orders/order-tracking-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("orders");
  return {
    title: `${t("trackOrder")} - ${id.slice(-6)}`,
  };
}

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const customerId = session.user.odooPartnerId || "";

  const { order, packages, shipments } = await getOrderWithDetails(id, customerId);
  if (!order) notFound();

  return (
    <OrderTrackingContent
      order={order}
      packages={packages}
      shipments={shipments}
      currencyCode={session.user.currencyCode || "IQD"}
    />
  );
}
