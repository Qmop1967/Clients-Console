import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { ProductsContent } from "@/components/products/products-content";
import { ProductsSkeleton } from "@/components/products/products-skeleton";

export async function generateMetadata() {
  const t = await getTranslations("products");
  return {
    title: t("title"),
  };
}

export default async function ProductsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContent
          priceListId={session.user.priceListId}
          currencyCode={session.user.currencyCode || "IQD"}
        />
      </Suspense>
    </div>
  );
}
