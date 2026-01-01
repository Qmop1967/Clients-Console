import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/products/product-detail-content";
import { getProduct, getProductImageUrl } from "@/lib/zoho/products";
import { getCustomerPriceList, getItemPriceFromList, PRICE_LIST_IDS } from "@/lib/zoho/price-lists";
import { getUnifiedStock } from "@/lib/zoho/stock-cache";
import { getZohoCustomer } from "@/lib/zoho/customers";
import { auth } from "@/lib/auth/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

// PERFORMANCE: Use ISR with 2-minute revalidation instead of force-dynamic
// Auth check still runs on each request, but product data is cached
// This dramatically improves TTFB for product pages
export const revalidate = 120; // 2 minutes - balance between freshness and performance

interface ProductPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params;

  try {
    const product = await getProduct(id);
    if (!product) {
      return { title: "Product Not Found" };
    }

    return {
      title: `${product.name} - TSH Shop`,
      description: product.description || `Buy ${product.name} from TSH Shop`,
    };
  } catch {
    return { title: "Loading Product..." };
  }
}

type FetchResult = {
  success: true;
  product: {
    item_id: string;
    name: string;
    sku: string;
    description: string;
    rate: number;
    available_stock: number;
    image_url: string | null;
    category_id: string | undefined;
    category_name: string | undefined;
    brand: string | undefined;
    unit: string;
    inPriceList: boolean;
    currencyCode: string;
  };
} | {
  success: false;
  error: "not_found" | "rate_limited" | "error";
};

async function fetchProductData(productId: string, priceListId?: string): Promise<FetchResult> {
  try {
    // PERFORMANCE: Run all API calls in parallel to reduce TTFB
    // This prevents 503 errors on RSC prefetch by reducing function execution time
    const effectivePriceListId = priceListId || PRICE_LIST_IDS.CONSUMER;

    const [product, stockResult, priceList] = await Promise.all([
      getProduct(productId),
      getUnifiedStock(productId, {
        fetchOnMiss: true,
        context: 'product-detail',
      }),
      getCustomerPriceList(effectivePriceListId, [productId]),
    ]);

    if (!product) {
      return { success: false, error: "not_found" };
    }

    const { stock: availableStock, source: stockSource } = stockResult;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ProductDetail] ${product.sku}: stock=${availableStock} (source: ${stockSource})`);
    }

    const priceInfo = getItemPriceFromList(productId, priceList);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ProductDetail] ${product.sku}: Final stock=${availableStock}, price=${priceInfo.rate} ${priceList?.currency_code}`);
    }

    return {
      success: true,
      product: {
        item_id: product.item_id,
        name: product.name,
        sku: product.sku,
        description: product.description || "",
        rate: priceInfo.rate,
        available_stock: availableStock,
        image_url: getProductImageUrl(product),
        category_id: product.category_id,
        category_name: product.category_name,
        brand: product.brand,
        unit: product.unit || "pcs",
        inPriceList: priceInfo.inPriceList,
        currencyCode: priceList?.currency_code || "IQD",
      }
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("429") || errorMsg.includes("rate") || errorMsg.includes("blocked")) {
      return { success: false, error: "rate_limited" };
    }
    return { success: false, error: "error" };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, id } = await params;

  // Check if user is authenticated to use their price list
  const session = await auth();
  let priceListId: string | undefined;

  if (session?.user?.zohoContactId) {
    // Try to get customer's price list
    priceListId = session.user.priceListId;

    // If not in session, fetch from Zoho
    if (!priceListId) {
      try {
        const customer = await getZohoCustomer(session.user.zohoContactId);
        if (customer) {
          priceListId = customer.pricebook_id || customer.price_list_id || undefined;
        }
      } catch (e) {
        console.error('[ProductDetail] Failed to fetch customer price list:', e);
      }
    }

    // If no price list ID after checking session and Zoho, fall back to Consumer (public pricing)
    // Do NOT guess based on currency - customer could be on any price list (Wholesale, Technical, etc.)
    if (!priceListId) {
      priceListId = PRICE_LIST_IDS.CONSUMER;
    }
  }

  const result = await fetchProductData(id, priceListId);

  if (!result.success) {
    if (result.error === "not_found") {
      notFound();
    }

    // Show error page for rate limiting or other errors
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 px-4 text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">
          {result.error === "rate_limited"
            ? "Server Busy"
            : "Unable to Load Product"}
        </h1>
        <p className="max-w-md text-muted-foreground">
          {result.error === "rate_limited"
            ? "We're experiencing high traffic. Please wait a moment and try again."
            : "Something went wrong while loading this product."}
        </p>
        <div className="flex gap-3">
          <Link href={`/shop/${id}`}>
            <Button variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline">Back to Shop</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailContent
          product={result.product}
          locale={locale}
        />
      </Suspense>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="aspect-square animate-pulse rounded-lg bg-muted" />
      <div className="space-y-4">
        <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-20 animate-pulse rounded bg-muted" />
        <div className="h-12 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
