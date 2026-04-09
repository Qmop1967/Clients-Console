import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getPendingDeliveries } from "@/lib/odoo/deliveries";
import { DeliveryConfirmContent } from "@/components/deliveries/delivery-confirm-content";

export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("deliveryConfirm");
  return { title: t("title") };
}

export default async function DeliveryConfirmPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customerId = session.user.odooPartnerId || "";
  const deliveries = customerId ? await getPendingDeliveries(customerId) : [];

  return (
    <div className="container mx-auto px-4 py-6">
      <DeliveryConfirmContent deliveries={deliveries} />
    </div>
  );
}
