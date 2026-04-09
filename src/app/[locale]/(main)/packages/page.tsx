import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getCustomerPackages } from "@/lib/odoo/packages";
import { PackagesContent } from "@/components/packages/packages-content";

export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("packages");
  return { title: t("title") };
}

export default async function PackagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customerId = session.user.odooPartnerId || "";
  const { packages, total } = customerId
    ? await getCustomerPackages(customerId)
    : { packages: [], total: 0 };

  return (
    <div className="container mx-auto px-4 py-6">
      <PackagesContent packages={packages} total={total} />
    </div>
  );
}
