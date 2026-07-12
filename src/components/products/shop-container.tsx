"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PublicProductsContent } from "./public-products-content";

// Product type from server
interface PublicProduct {
  item_id: string;
  name: string;
  localized_names?: { ar?: string; ckb?: string; kmr?: string; tm?: string };
  sku: string;
  description?: string;
  rate: number;
  available_stock: number;
  image_url?: string | null;
  category_id?: string;
  category_name?: string;
  brand?: string;
  unit: string;
  inPriceList?: boolean;
  create_date?: string;
}

// Category type from server
interface PublicCategory {
  category_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface ShopContainerProps {
  products: PublicProduct[];
  categories: PublicCategory[];
  currencyCode: string;
}

// Loading fallback component
function ShopContainerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-28 sm:h-32 w-full bg-muted animate-pulse rounded-2xl" />
      <div className="flex gap-2">
        <div className="h-10 w-20 bg-muted animate-pulse rounded-full" />
        <div className="h-10 w-24 bg-muted animate-pulse rounded-full" />
        <div className="h-10 w-24 bg-muted animate-pulse rounded-full" />
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

// Inner component that uses useSearchParams
function ShopContainerInner({
  products,
  categories,
  currencyCode,
}: ShopContainerProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Selected category from URL (drives the category strip + grid filter)
  const selectedCategory = searchParams.get("category");

  // Filter products by selected category (grid). The rail always uses the full list.
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  const getCategoryName = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => c.category_id === categoryId);
      return category?.name || categoryId;
    },
    [categories]
  );

  // Select a category (from the strip)
  // BUGFIX: keep search/sort, but ALWAYS drop `page`. A new category must start at
  // page 1 — a stale ?page=2 made any 1-page category render as an empty grid.
  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("category", categoryId);
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Clear the active category filter
  const handleClearCategory = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    params.delete("page");
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <PublicProductsContent
      products={filteredProducts}
      allProducts={products}
      categories={categories}
      currencyCode={currencyCode}
      selectedCategory={selectedCategory}
      selectedCategoryName={selectedCategory ? getCategoryName(selectedCategory) : null}
      onClearCategory={handleClearCategory}
      onCategorySelect={handleCategorySelect}
    />
  );
}

// Main export with Suspense wrapper
export function ShopContainer(props: ShopContainerProps) {
  return (
    <Suspense fallback={<ShopContainerSkeleton />}>
      <ShopContainerInner {...props} />
    </Suspense>
  );
}
