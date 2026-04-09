import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getAccountStatement } from "@/lib/odoo/statements";
import { AccountStatementContent } from "@/components/statements/account-statement-content";

// ISR: Revalidate every 60 seconds for fresher statement data
export const revalidate = 60;

export async function generateMetadata() {
  const t = await getTranslations("accountStatement");
  return {
    title: t("title"),
  };
}

export default async function AccountStatementPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const currencyCode = session.user.currencyCode || "IQD";

  // Fetch account statement data from API
  const statement = await getAccountStatement(session.user.odooPartnerId || "");

  return (
    <div className="container mx-auto px-4 py-6">
      <AccountStatementContent
        statement={statement}
        currencyCode={currencyCode}
      />
    </div>
  );
}
