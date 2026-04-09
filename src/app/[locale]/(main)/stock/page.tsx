import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { StockCheckContent } from "@/components/stock/stock-check-content";

export const revalidate = 0; // Always fresh for stock

export async function generateMetadata() {
  const t = await getTranslations("stockCheck");
  return { title: t("title") };
}

export default async function StockPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currencyCode = session.user.currencyCode || "IQD";

  return (
    <div className="container mx-auto px-4 py-6">
      <StockCheckContent currencyCode={currencyCode} />
    </div>
  );
}
