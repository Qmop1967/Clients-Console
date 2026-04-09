import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getCustomerDeliveries } from "@/lib/odoo/deliveries";
import { DeliveriesContent } from "@/components/deliveries/deliveries-content";

export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("deliveries");
  return { title: t("title") };
}

export default async function DeliveriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customerId = session.user.odooPartnerId || "";
  const deliveries = customerId ? await getCustomerDeliveries(customerId) : [];

  return (
    <div className="container mx-auto px-4 py-6">
      <DeliveriesContent deliveries={deliveries} />
    </div>
  );
}
