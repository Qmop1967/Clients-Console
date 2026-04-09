import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getCustomerQuotations } from "@/lib/odoo/quotations";
import { QuotationsContent } from "@/components/quotations/quotations-content";

export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("quotations");
  return { title: t("title") };
}

export default async function QuotationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customerId = session.user.odooPartnerId || "";
  const currencyCode = session.user.currencyCode || "IQD";

  const quotations = customerId ? await getCustomerQuotations(customerId) : [];

  return (
    <div className="container mx-auto px-4 py-6">
      <QuotationsContent
        quotations={quotations}
        currencyCode={currencyCode}
      />
    </div>
  );
}
