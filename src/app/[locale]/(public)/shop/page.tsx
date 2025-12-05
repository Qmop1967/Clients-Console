import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PublicProductsContent } from "@/components/products/public-products-content";
import { ProductsSkeleton } from "@/components/products/products-skeleton";
import { getAllProductsComplete, getCategories, getProductImageUrl } from "@/lib/zoho/products";
import { getCustomerPriceList, getItemPriceFromList, PRICE_LIST_IDS } from "@/lib/zoho/price-lists";
import { auth } from "@/lib/auth/auth";
import { getZohoCustomer } from "@/lib/zoho/customers";

// Force dynamic rendering to ensure auth check runs on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("products");
  return {
    title: `${t("title")} - TSH Shop`,
    description: "Browse our catalog of IT products, security systems, networking equipment, and more.",
  };
}

/**
 * Fetch shop data with appropriate pricing
 * - Authenticated users: Use their assigned price list
 * - Public visitors: Use Consumer price list (IQD)
 * IMPORTANT: Uses Zoho Books API /items/pricebookrate to fetch item prices
 */
async function fetchShopData(priceListId: string) {
  try {
    console.log(`🚀 fetchShopData: Starting with priceListId=${priceListId}`);

    // First fetch ALL products and categories in parallel
    const [allProducts, categories] = await Promise.all([
      getAllProductsComplete(), // Fetches ALL products with pagination
      getCategories(),
    ]);

    console.log(`📦 fetchShopData: Got ${allProducts.length} products and ${categories.length} categories`);

    // Extract all item IDs for price lookup
    const itemIds = allProducts.map((p) => p.item_id);
    console.log(`🔑 fetchShopData: Extracted ${itemIds.length} item IDs for price lookup`);

    // Fetch price list WITH item prices (uses Books API endpoint)
    console.log(`💵 fetchShopData: Fetching price list (${priceListId}) with ${itemIds.length} items...`);
    const priceList = await getCustomerPriceList(priceListId, itemIds);

    console.log(`📋 Price list result:`, {
      name: priceList?.name,
      currency: priceList?.currency_code,
      pricebook_items_count: priceList?.pricebook_items?.length || 0,
      item_prices_count: priceList?.item_prices?.length || 0,
    });

    console.log(`🛒 Processing ${allProducts.length} products with price list: ${priceList?.name || 'unknown'}`);

    // Map products with prices from the customer's price list
    // IMPORTANT: Uses prices from pricebook, NOT item.rate (sell price)
    const productsWithPrices = allProducts.map((product) => {
      const priceInfo = getItemPriceFromList(
        product.item_id,
        priceList
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
    console.log(`💰 ${itemsWithPrices}/${productsWithPrices.length} products have prices in ${priceList?.name || 'price list'}`);

    return {
      products: productsWithPrices,
      categories: categories.filter((c) => c.is_active),
      currencyCode: priceList?.currency_code || "IQD",
      currencySymbol: priceList?.currency_symbol || "IQD",
      totalProducts: allProducts.length,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching shop data:", error);

    // Detect rate limit errors
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMsg.includes('429') ||
                        errorMsg.includes('rate') ||
                        errorMsg.includes('exceeded') ||
                        errorMsg.includes('blocked');

    return {
      products: [],
      categories: [],
      currencyCode: "IQD",
      currencySymbol: "IQD",
      totalProducts: 0,
      error: isRateLimit ? "rate_limit" : "general",
    };
  }
}

export default async function PublicShopPage() {
  const t = await getTranslations("products");

  // Check authentication - use customer's price list if authenticated
  const session = await auth();
  let priceListId: string = PRICE_LIST_IDS.CONSUMER; // Default for public visitors

  if (session?.user?.zohoContactId) {
    // Authenticated user - get their price list
    priceListId = session.user.priceListId || PRICE_LIST_IDS.CONSUMER;
    console.log(`[Shop] Authenticated user: ${session.user.email}, priceListId: ${priceListId}`);

    // If no price list in session, try to fetch from Zoho
    if (!session.user.priceListId) {
      try {
        const customer = await getZohoCustomer(session.user.zohoContactId);
        if (customer) {
          priceListId = customer.pricebook_id || customer.price_list_id || PRICE_LIST_IDS.CONSUMER;
          console.log(`[Shop] Fetched priceListId from Zoho: ${priceListId}`);
        }
      } catch (e) {
        console.error('[Shop] Failed to fetch customer price list:', e);
      }
    }
  } else {
    console.log(`[Shop] Public visitor - using Consumer price list (IQD)`);
  }

  const { products, currencyCode, error } = await fetchShopData(priceListId);

  return (
    <div className="space-y-6">
      {/* Error State */}
      {error && products.length === 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
            <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300 mb-2">
            {error === "rate_limit" ? t("rateLimitError") : t("noProducts")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {error === "rate_limit"
              ? t("rateLimitDescription")
              : "Our product catalog is being updated. Please check back soon."}
          </p>
          <a
            href="?"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </a>
        </div>
      )}

      {/* Products */}
      <Suspense fallback={<ProductsSkeleton />}>
        <PublicProductsContent
          products={products}
          currencyCode={currencyCode}
        />
      </Suspense>
    </div>
  );
}
