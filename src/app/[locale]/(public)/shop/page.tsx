import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PublicProductsContent } from "@/components/products/public-products-content";
import { ProductsSkeleton } from "@/components/products/products-skeleton";
import { getProductsWithPrices, getProductsWithConsumerPrices, getProductImageUrl } from "@/lib/zoho/products";
import { PRICE_LIST_IDS } from "@/lib/zoho/price-lists";
import { auth } from "@/lib/auth/auth";
import { getZohoCustomerFresh } from "@/lib/zoho/customers";

// CRITICAL: Force dynamic rendering for authenticated users
// This ensures the page fetches fresh customer data and correct price lists
// ISR was causing authenticated users to see cached static pages with wrong prices
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations("products");
  return {
    title: `${t("title")} - TSH Shop`,
    description: "Browse our catalog of IT products, security systems, networking equipment, and more.",
  };
}

/**
 * OPTIMIZED: Fetch shop data using cached products with prices
 * - Uses cached getProductsWithPrices (24h cache)
 * - Stock is fresh from Redis on every call
 * - Reduces API calls from ~15 to ~1-2 per request
 */
async function fetchShopData(priceListId: string, isPublicVisitor: boolean) {
  try {
    // Use cached data - products + prices cached together for 24h
    // Stock is always fresh from Redis
    const { products: allProducts, currency } = isPublicVisitor
      ? await getProductsWithConsumerPrices()
      : await getProductsWithPrices(priceListId);

    // Map to display format - keep it minimal for faster serialization
    const productsWithPrices = allProducts.map((product) => ({
      item_id: product.item_id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      rate: product.display_price || 0,
      available_stock: product.available_stock ?? 0,
      image_url: getProductImageUrl(product),
      category_id: product.category_id,
      category_name: product.category_name,
      brand: product.brand,
      unit: product.unit,
      inPriceList: product.in_price_list ?? (product.display_price > 0),
    }));

    // Filter to only in-stock products
    const inStockProducts = productsWithPrices.filter(p => p.available_stock > 0);

    return {
      products: inStockProducts,
      currencyCode: currency,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching shop data:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate');

    return {
      products: [],
      currencyCode: "IQD",
      error: isRateLimit ? "rate_limit" : "general",
    };
  }
}

// Separate async component for products - enables streaming
async function ProductsLoader({
  priceListId,
  isPublicVisitor,
  isAuthenticated,
}: {
  priceListId: string;
  isPublicVisitor: boolean;
  isAuthenticated: boolean;
}) {
  const t = await getTranslations("products");
  const { products, currencyCode, error } = await fetchShopData(priceListId, isPublicVisitor);

  // Error State
  if (error && products.length === 0) {
    return (
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
    );
  }

  return (
    <PublicProductsContent
      products={products}
      currencyCode={currencyCode}
      isAuthenticated={isAuthenticated}
    />
  );
}

export default async function PublicShopPage() {
  // Check authentication - use customer's price list if authenticated
  // This is fast since it reads from session cookie
  const session = await auth();
  const isAuthenticated = !!session?.user?.zohoContactId;
  const isPublicVisitor = !isAuthenticated;

  let priceListId: string = PRICE_LIST_IDS.CONSUMER;

  if (isAuthenticated && session.user.zohoContactId) {
    // ALWAYS fetch fresh customer data to get current price list
    // This handles cases where customer's price list was changed in Zoho
    // but session still has old cached data
    try {
      const customer = await getZohoCustomerFresh(session.user.zohoContactId);
      if (customer) {
        priceListId = customer.pricebook_id || customer.price_list_id || PRICE_LIST_IDS.CONSUMER;
      }
    } catch {
      // Fall back to session data, then consumer price list
      priceListId = session.user.priceListId || PRICE_LIST_IDS.CONSUMER;
    }
  }

  return (
    <div className="space-y-6">
      {/* Use Suspense to enable streaming - shows skeleton immediately */}
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsLoader
          priceListId={priceListId}
          isPublicVisitor={isPublicVisitor}
          isAuthenticated={isAuthenticated}
        />
      </Suspense>
    </div>
  );
}
