import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PublicProductsContent } from "@/components/products/public-products-content";
import { ProductsSkeleton } from "@/components/products/products-skeleton";
import { getAllProductsComplete, getCategories, getProductImageUrl } from "@/lib/zoho/products";
import { getCustomerPriceList, getItemPriceFromList, PRICE_LIST_IDS } from "@/lib/zoho/price-lists";

export async function generateMetadata() {
  const t = await getTranslations("products");
  return {
    title: `${t("title")} - TSH Shop`,
    description: "Browse our catalog of IT products, security systems, networking equipment, and more.",
  };
}

/**
 * Fetch public shop data with Consumer pricing
 * IMPORTANT: Uses Zoho Books API /items/pricebookrate to fetch item prices
 * because Zoho Inventory /pricebooks endpoint doesn't reliably return items
 */
async function fetchPublicShopData() {
  try {
    console.log('🚀 fetchPublicShopData: Starting...');

    // First fetch ALL products and categories in parallel
    const [allProducts, categories] = await Promise.all([
      getAllProductsComplete(), // Fetches ALL products with pagination
      getCategories(),
    ]);

    console.log(`📦 fetchPublicShopData: Got ${allProducts.length} products and ${categories.length} categories`);

    // Extract all item IDs for price lookup
    const itemIds = allProducts.map((p) => p.item_id);
    console.log(`🔑 fetchPublicShopData: Extracted ${itemIds.length} item IDs for price lookup`);
    console.log(`🔑 Sample item IDs:`, itemIds.slice(0, 3));

    // Fetch Consumer price list WITH item prices (uses Books API endpoint)
    console.log(`💵 fetchPublicShopData: Fetching Consumer price list (${PRICE_LIST_IDS.CONSUMER}) with ${itemIds.length} items...`);
    const consumerPriceList = await getCustomerPriceList(PRICE_LIST_IDS.CONSUMER, itemIds);

    console.log(`📋 Consumer price list result:`, {
      name: consumerPriceList?.name,
      currency: consumerPriceList?.currency_code,
      pricebook_items_count: consumerPriceList?.pricebook_items?.length || 0,
      item_prices_count: consumerPriceList?.item_prices?.length || 0,
    });

    console.log(`🛒 Processing ${allProducts.length} products with Consumer price list`);

    // Map products with consumer prices from price list
    // IMPORTANT: Uses prices from Consumer pricebook, NOT item.rate (sell price)
    const productsWithPrices = allProducts.map((product) => {
      const priceInfo = getItemPriceFromList(
        product.item_id,
        consumerPriceList
      );

      return {
        item_id: product.item_id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        rate: priceInfo.rate, // Price from Consumer price list (NOT item.rate)
        available_stock: product.available_stock ?? product.stock_on_hand ?? 0,
        image_url: getProductImageUrl(product), // Construct image URL from Zoho data
        category_id: product.category_id,
        category_name: product.category_name,
        brand: product.brand,
        unit: product.unit,
        inPriceList: priceInfo.inPriceList, // Whether item has a price in the list
      };
    });

    // Count items with prices vs without
    const itemsWithPrices = productsWithPrices.filter(p => p.inPriceList).length;
    console.log(`💰 ${itemsWithPrices}/${productsWithPrices.length} products have Consumer prices`);

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
