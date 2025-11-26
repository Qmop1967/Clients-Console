import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AuthenticatedProductsContent } from "@/components/products/authenticated-products-content";
import { ProductsSkeleton } from "@/components/products/products-skeleton";
import { getAllProductsComplete, getCategories, getProductImageUrl } from "@/lib/zoho/products";
import { getCustomerPriceList, getItemPriceFromList, PRICE_LIST_IDS } from "@/lib/zoho/price-lists";

export async function generateMetadata() {
  const t = await getTranslations("products");
  return {
    title: t("title"),
  };
}

/**
 * Fetch products with customer-specific pricing
 * Uses the customer's assigned price list from Zoho
 * Falls back to Consumer price list if none assigned
 *
 * IMPORTANT: Uses Zoho Books API /items/pricebookrate to fetch item prices
 * because Zoho Inventory /pricebooks endpoint doesn't reliably return items
 */
async function fetchAuthenticatedProducts(priceListId?: string) {
  try {
    // First fetch products and categories in parallel
    const [allProducts, categories] = await Promise.all([
      getAllProductsComplete(),
      getCategories(),
    ]);

    // Extract all item IDs for price lookup
    const itemIds = allProducts.map((p) => p.item_id);

    // Now fetch price list WITH item prices (uses Books API endpoint)
    const priceList = await getCustomerPriceList(priceListId, itemIds);

    console.log(`🔐 Authenticated user - Price list: ${priceList?.name || 'Consumer (default)'} (ID: ${priceListId || PRICE_LIST_IDS.CONSUMER})`);
    console.log(`📦 Processing ${allProducts.length} products with ${priceList?.currency_code || 'IQD'} pricing`);

    // Map products with prices from customer's price list
    const productsWithPrices = allProducts.map((product) => {
      const priceInfo = getItemPriceFromList(product.item_id, priceList);

      return {
        item_id: product.item_id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        rate: priceInfo.rate,
        available_stock: product.available_stock ?? product.stock_on_hand ?? 0,
        image_url: getProductImageUrl(product),
        category_id: product.category_id,
        category_name: product.category_name,
        brand: product.brand,
        unit: product.unit,
        inPriceList: priceInfo.inPriceList,
      };
    });

    // Count items with prices
    const itemsWithPrices = productsWithPrices.filter(p => p.inPriceList).length;
    console.log(`💰 ${itemsWithPrices}/${productsWithPrices.length} products have prices in ${priceList?.name || 'default'} list`);

    return {
      products: productsWithPrices,
      categories: categories.filter((c) => c.is_active),
      currencyCode: priceList?.currency_code || "IQD",
      currencySymbol: priceList?.currency_symbol || "IQD",
      priceListName: priceList?.name || "Consumer",
      error: null,
    };
  } catch (error) {
    console.error("Error fetching authenticated products:", error);
    return {
      products: [],
      categories: [],
      currencyCode: "IQD",
      currencySymbol: "IQD",
      priceListName: "Consumer",
      error: "Unable to load products. Please try again later.",
    };
  }
}

export default async function ProductsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch products with customer's price list
  const { products, categories, currencyCode, priceListName, error } =
    await fetchAuthenticatedProducts(session.user.priceListId);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<ProductsSkeleton />}>
        <AuthenticatedProductsContent
          products={products}
          categories={categories}
          currencyCode={currencyCode}
          priceListName={priceListName}
          error={error}
        />
      </Suspense>
    </div>
  );
}
