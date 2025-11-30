import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getAccountStatement } from "@/lib/zoho/statements";
import { AccountStatementContent } from "@/components/statements/account-statement-content";

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

  const currencyCode = session.user.currencyCode || "USD";

  // Fetch account statement data from Zoho
  const statement = await getAccountStatement(session.user.zohoContactId || "");

  return (
    <div className="container mx-auto px-4 py-6">
      <AccountStatementContent
        statement={statement}
        currencyCode={currencyCode}
      />
    </div>
  );
}
