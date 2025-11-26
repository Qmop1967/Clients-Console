import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PublicProductsContent } from "@/components/products/public-products-content";
import { ProductsSkeleton } from "@/components/products/products-skeleton";
import { getAllProductsComplete, getCategories, getProductImageUrl } from "@/lib/zoho/products";
import { getConsumerPriceList, getItemPriceFromList } from "@/lib/zoho/price-lists";

export async function generateMetadata() {
  const t = await getTranslations("products");
  return {
    title: `${t("title")} - TSH Shop`,
    description: "Browse our catalog of IT products, security systems, networking equipment, and more.",
  };
}

async function fetchPublicShopData() {
  try {
    // Fetch ALL products (with full pagination), categories, and consumer price list in parallel
    const [allProducts, categories, consumerPriceList] = await Promise.all([
      getAllProductsComplete(), // Now fetches ALL products with pagination
      getCategories(),
      getConsumerPriceList(),
    ]);

    // Map products with consumer prices
    const productsWithPrices = allProducts.map((product) => {
      const priceInfo = getItemPriceFromList(
        product.item_id,
        consumerPriceList,
        product.rate
      );

      return {
        item_id: product.item_id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        rate: priceInfo.rate,
        stock_on_hand: product.stock_on_hand,
        available_stock: product.available_stock,
        image_url: getProductImageUrl(product), // Construct image URL from Zoho data
        category_id: product.category_id,
        category_name: product.category_name,
        brand: product.brand,
        unit: product.unit,
      };
    });

    return {
      products: productsWithPrices,
      categories: categories.filter((c) => c.is_active),
      currencyCode: consumerPriceList?.currency_code || "IQD",
      currencySymbol: consumerPriceList?.currency_symbol || "IQD",
      totalProducts: allProducts.length, // Now reflects actual total
      error: null,
    };
  } catch (error) {
    console.error("Error fetching public shop data:", error);
    return {
      products: [],
      categories: [],
      currencyCode: "IQD",
      currencySymbol: "IQD",
      totalProducts: 0,
      error: "Unable to load products. Please try again later.",
    };
  }
}

export default async function PublicShopPage() {
  const t = await getTranslations("products");
  const { products, categories, currencyCode, totalProducts, error } = await fetchPublicShopData();

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 p-8 text-center">
        <h1 className="text-3xl font-bold">{t("heroTitle")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("heroDescription")}
        </p>
        {totalProducts > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("productsAvailable", { count: totalProducts })}
          </p>
        )}
      </div>

      {/* Error State */}
      {error && products.length === 0 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
          <p className="text-yellow-600 dark:text-yellow-400">{error}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Our product catalog is being updated. Please check back soon.
          </p>
        </div>
      )}

      {/* Products */}
      <Suspense fallback={<ProductsSkeleton />}>
        <PublicProductsContent
          products={products}
          categories={categories}
          currencyCode={currencyCode}
        />
      </Suspense>
    </div>
  );
}
