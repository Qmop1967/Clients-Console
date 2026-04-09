import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getEligibleOrders } from "@/lib/odoo/returns";
import { NewReturnContent } from "@/components/returns/new-return-content";

export async function generateMetadata() {
  const t = await getTranslations("returns");
  return { title: t("requestReturn") };
}

export default async function NewReturnPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customerId = session.user.odooPartnerId;
  const currencyCode = session.user.currencyCode || "IQD";

  if (!customerId) {
    redirect("/returns");
  }

  const eligibleOrders = await getEligibleOrders(customerId);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <NewReturnContent
        eligibleOrders={eligibleOrders}
        currencyCode={currencyCode}
      />
    </div>
  );
}
