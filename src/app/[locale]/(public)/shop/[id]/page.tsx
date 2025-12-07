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

// Force dynamic rendering to ensure auth check runs on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    // Fetch product metadata
    const product = await getProduct(productId);

    if (!product) {
      return { success: false, error: "not_found" };
    }

    // Use UNIFIED stock retrieval - SAME source as shop list page
    // This ensures consistent stock between list and detail views
    const { stock: availableStock, source: stockSource } = await getUnifiedStock(productId, {
      fetchOnMiss: true, // Detail page can afford the API call for fresh stock
      context: 'product-detail',
    });

    console.log(`[ProductDetail] ${product.sku}: stock=${availableStock} (source: ${stockSource})`);

    // Fetch price list - use customer's if provided, otherwise Consumer
    const effectivePriceListId = priceListId || PRICE_LIST_IDS.CONSUMER;
    const priceList = await getCustomerPriceList(effectivePriceListId, [product.item_id]);
    const priceInfo = getItemPriceFromList(product.item_id, priceList);

    console.log(`[ProductDetail] ${product.sku}: Final stock=${availableStock}, price=${priceInfo.rate} ${priceList?.currency_code}`);

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

  // Debug: Log session state
  console.log(`[ProductDetail] Auth check - Session exists: ${!!session}, User: ${session?.user?.email || 'none'}, ZohoContactId: ${session?.user?.zohoContactId || 'none'}`);

  if (session?.user?.zohoContactId) {
    // Try to get customer's price list
    priceListId = session.user.priceListId;
    console.log(`[ProductDetail] Authenticated user - priceListId from session: ${priceListId}`);

    // If not in session, fetch from Zoho
    if (!priceListId) {
      try {
        const customer = await getZohoCustomer(session.user.zohoContactId);
        if (customer) {
          priceListId = customer.pricebook_id || customer.price_list_id || undefined;
          console.log(`[ProductDetail] Fetched priceListId from Zoho: ${priceListId}`);
        }
      } catch (e) {
        console.error('[ProductDetail] Failed to fetch customer price list:', e);
      }
    }

    // Default based on currency if still no price list
    if (!priceListId) {
      priceListId = session.user.currencyCode === 'USD'
        ? PRICE_LIST_IDS.RETAILOR
        : PRICE_LIST_IDS.CONSUMER;
      console.log(`[ProductDetail] Using default priceListId based on currency: ${priceListId}`);
    }
  } else {
    console.log(`[ProductDetail] Not authenticated - using Consumer price list (IQD)`);
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
