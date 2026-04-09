import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getCustomerReturns, getEligibleOrders } from "@/lib/odoo/returns";
import { ReturnsContent } from "@/components/returns/returns-content";

export const revalidate = 60;

export async function generateMetadata() {
  const t = await getTranslations("returns");
  return { title: t("title") };
}

export default async function ReturnsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customerId = session.user.odooPartnerId;
  const currencyCode = session.user.currencyCode || "IQD";

  if (!customerId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <ReturnsContent returns={[]} eligibleOrders={[]} currencyCode={currencyCode} customerId="" />
      </div>
    );
  }

  const [returns, eligibleOrders] = await Promise.all([
    getCustomerReturns(customerId),
    getEligibleOrders(customerId),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      <ReturnsContent
        returns={returns}
        eligibleOrders={eligibleOrders}
        currencyCode={currencyCode}
        customerId={customerId}
      />
    </div>
  );
}
