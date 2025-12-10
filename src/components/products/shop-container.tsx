"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, Layers } from "lucide-react";
import { CategoriesGrid } from "./categories-grid";
import { PublicProductsContent } from "./public-products-content";
import { cn } from "@/lib/utils/cn";

// Product type from server
interface PublicProduct {
  item_id: string;
  name: string;
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
  isAuthenticated?: boolean;
}

type TabValue = "products" | "categories";

export function ShopContainer({
  products,
  categories,
  currencyCode,
  isAuthenticated = false,
}: ShopContainerProps) {
  const t = useTranslations("products");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Get current tab from URL, default to "products"
  const currentTab = (searchParams.get("view") as TabValue) || "products";

  // Get selected category from URL
  const selectedCategory = searchParams.get("category");

  // Calculate product counts per category
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((product) => {
      if (product.category_id) {
        counts[product.category_id] = (counts[product.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  // Get category name by ID
  const getCategoryName = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => c.category_id === categoryId);
      return category?.name || categoryId;
    },
    [categories]
  );

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === "products") {
        params.delete("view");
      } else {
        params.set("view", value);
      }

      // Clear category filter when switching to categories tab
      if (value === "categories") {
        params.delete("category");
        params.delete("page");
        params.delete("q");
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Handle category selection (from categories tab)
  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      const params = new URLSearchParams();
      params.set("category", categoryId);
      // Switch to products tab with category filter
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router]
  );

  // Handle clearing category filter
  const handleClearCategory = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    params.delete("page");
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <div className="space-y-6">
      {/* Shop Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        {/* Product Count Badge */}
        <Badge variant="secondary" className="w-fit">
          {t("productsAvailable", { count: products.length })}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs
        value={selectedCategory ? "products" : currentTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger
            value="products"
            className={cn(
              "flex items-center gap-2",
              "data-[state=active]:bg-gold data-[state=active]:text-white"
            )}
          >
            <Package className="h-4 w-4" />
            {t("allProducts")}
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className={cn(
              "flex items-center gap-2",
              "data-[state=active]:bg-gold data-[state=active]:text-white"
            )}
          >
            <Layers className="h-4 w-4" />
            {t("categories")}
          </TabsTrigger>
        </TabsList>

        {/* Products Tab Content */}
        <TabsContent value="products" className="mt-0">
          <PublicProductsContent
            products={filteredProducts}
            categories={categories}
            currencyCode={currencyCode}
            isAuthenticated={isAuthenticated}
            selectedCategory={selectedCategory}
            selectedCategoryName={selectedCategory ? getCategoryName(selectedCategory) : null}
            onClearCategory={handleClearCategory}
          />
        </TabsContent>

        {/* Categories Tab Content */}
        <TabsContent value="categories" className="mt-0">
          <CategoriesGrid
            categories={categories}
            productCounts={productCounts}
            onCategorySelect={handleCategorySelect}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
