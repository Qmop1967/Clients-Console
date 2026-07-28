import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/products/product-detail-content";
import { getPublicProductByIdStrictCached } from "@/lib/odoo/products";
import { getCustomerPriceList, getItemPriceFromList, getConsumerPricelistId, isValidPublicPrice } from "@/lib/odoo/pricelists";
import { getUnifiedStock } from "@/lib/odoo/stock";
import { getCustomer } from "@/lib/odoo/customers";
import { auth } from "@/lib/auth/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { localeToOdooLang } from "@/i18n/config";

// Personalized price and stock data must never enter a shared page cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProductPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { locale, id } = await params;

  try {
    const product = await getPublicProductByIdStrictCached(id, localeToOdooLang(locale));
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
    localized_names?: { ar?: string; ckb?: string; kmr?: string; tm?: string };
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
    minimum_quantity?: number;
    alias_name?: string;
    more_detail?: string;
    use_cases?: string;
  };
} | {
  success: false;
  error: "not_found" | "rate_limited" | "error";
};

async function fetchProductData(productId: string, priceListId: string | undefined, lang: string | undefined, isAuthenticated: boolean): Promise<FetchResult> {
  try {
    // PERFORMANCE: Run all API calls in parallel to reduce TTFB
    // This prevents 503 errors on RSC prefetch by reducing function execution time
    const effectivePriceListId = priceListId || await getConsumerPricelistId();

    const [product, stockResult, priceList] = await Promise.all([
      getPublicProductByIdStrictCached(productId, lang),
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
    const canDisplayPrice = priceInfo.inPriceList && (
      isAuthenticated || isValidPublicPrice(priceInfo.rate, priceInfo.currency)
    );

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ProductDetail] ${product.sku}: Final stock=${availableStock}, price=${priceInfo.rate} ${priceList?.currency_code}`);
    }

    return {
      success: true,
      product: {
        item_id: product.item_id,
        name: product.name,
        localized_names: product.localized_names,
        sku: product.sku,
        description: product.description || "",
        rate: canDisplayPrice ? priceInfo.rate : 0,
        available_stock: isAuthenticated ? availableStock : (availableStock > 0 ? 1 : 0),
        image_url: product.image_url || null,
        category_id: product.category_id,
        category_name: product.category_name,
        brand: product.brand,
        unit: product.unit || "pcs",
        inPriceList: canDisplayPrice,
        currencyCode: priceList?.currency_code || "IQD",
        minimum_quantity: product.minimum_quantity,
        alias_name: product.alias_name,
        more_detail: product.more_detail,
        use_cases: product.use_cases,
      }
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string } | null)?.code;
    const errStatus = (error as { status?: number } | null)?.status;
    if (errCode === "RATE_LIMIT_EXCEEDED" || errStatus === 429 || errorMsg.includes("429") || errorMsg.includes("rate") || errorMsg.includes("blocked")) {
      return { success: false, error: "rate_limited" };
    }
    return { success: false, error: "error" };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, id } = await params;

  // Check if user is authenticated to use their price list
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.odooPartnerId);
  let priceListId: string | undefined;

  if (session?.user?.odooPartnerId) {
    // Try to get customer's price list
    priceListId = session.user.priceListId;

    // If not in session, fetch from API
    if (!priceListId) {
      try {
        const customer = await getCustomer(session.user.odooPartnerId);
        if (customer) {
          priceListId = customer.pricebook_id || customer.price_list_id || undefined;
        }
      } catch (e) {
        console.error('[ProductDetail] Failed to fetch customer price list:', e);
      }
    }

    // If no price list ID after checking session and API, fall back to Consumer (public pricing)
    // Do NOT guess based on currency - customer could be on any price list (Wholesale, Technical, etc.)
    if (!priceListId) {
      priceListId = await getConsumerPricelistId();
    }
  }

  const result = await fetchProductData(id, priceListId, localeToOdooLang(locale), isAuthenticated);

  if (!result.success) {
    if (result.error === "not_found") {
      notFound();
    }

    // Error page. Every string here used to be hardcoded English while the rest of
    // the screen was Arabic — a half-translated failure page, shown at the exact
    // moment the customer is already frustrated.
    const t = await getTranslations("products");
    const isRateLimited = result.error === "rate_limited";
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 px-4 text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">
          {isRateLimited ? t("busyTitle") : t("loadErrorTitle")}
        </h1>
        <p className="max-w-md text-muted-foreground">
          {isRateLimited ? t("busyBody") : t("loadErrorBody")}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/shop/${id}`}>
            <Button variant="default" className="h-11">
              <RefreshCw className="me-2 h-4 w-4" />
              {t("tryAgain")}
            </Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline" className="h-11">{t("backToShop")}</Button>
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
          canOrder={isAuthenticated}
          showExactStock={isAuthenticated}
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
