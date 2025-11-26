"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductFilters } from "./product-filters";
import { ProductImage } from "./product-image";
import { Search, Filter, Grid, List } from "lucide-react";

// Product type from server
interface PublicProduct {
  item_id: string;
  name: string;
  sku: string;
  description?: string;
  rate: number;
  stock_on_hand: number;
  available_stock: number;
  image_url?: string | null;
  category_id?: string;
  category_name?: string;
  brand?: string;
  unit: string;
}

// Category type from server
interface PublicCategory {
  category_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface PublicProductsContentProps {
  products: PublicProduct[];
  categories: PublicCategory[];
  currencyCode: string;
}

export function PublicProductsContent({
  products,
  categories,
  currencyCode,
}: PublicProductsContentProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category_name === selectedCategory);
    }

    // Stock filter
    if (inStockOnly) {
      filtered = filtered.filter((p) => p.stock_on_hand > 0 || p.available_stock > 0);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.rate - b.rate;
        case "price-desc":
          return b.rate - a.rate;
        case "stock-desc":
          return b.stock_on_hand - a.stock_on_hand;
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, inStockOnly, sortBy]);

  // Products grouped by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, PublicProduct[]> = {};
    filteredProducts.forEach((product) => {
      const category = product.category_name || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    });
    return grouped;
  }, [filteredProducts]);

  // Get unique category names from products for filter buttons
  const availableCategories = useMemo(() => {
    const categoryNames = new Set<string>();
    products.forEach((p) => {
      if (p.category_name) {
        categoryNames.add(p.category_name);
      }
    });
    return Array.from(categoryNames).sort();
  }, [products]);

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IQ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <Grid className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          {t("all")} ({products.length})
        </Button>
        {availableCategories.map((categoryName) => (
          <Button
            key={categoryName}
            variant={selectedCategory === categoryName ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === categoryName ? null : categoryName
              )
            }
          >
            {categoryName}
          </Button>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <ProductFilters
          categories={categories.map((c) => ({ category_id: c.category_id, name: c.name }))}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          inStockOnly={inStockOnly}
          onInStockChange={setInStockOnly}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            {t("allProducts")} ({filteredProducts.length})
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex-1">
            {t("catalog")}
          </TabsTrigger>
        </TabsList>

        {/* All Products Tab */}
        <TabsContent value="all" className="mt-4">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t("noProducts")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.item_id}
                  className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-lg"
                >
                  {/* Product Image - Optimized with Next.js Image */}
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    className="aspect-square rounded-md mb-4"
                    priority={false}
                  />

                  {/* Product Info */}
                  <div className="space-y-2">
                    <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                    {product.brand && (
                      <p className="text-xs text-primary">{product.brand}</p>
                    )}
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-lg font-bold text-primary">
                        {formatPrice(product.rate)} {currencyCode}
                      </span>
                      <span
                        className={`text-xs ${
                          product.stock_on_hand > 0 || product.available_stock > 0
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {product.stock_on_hand > 0 || product.available_stock > 0
                          ? t("stockCount", { count: product.stock_on_hand || product.available_stock })
                          : t("outOfStock")}
                      </span>
                    </div>
                    {product.category_name && (
                      <p className="text-xs text-muted-foreground">
                        {product.category_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="mt-4">
          <div className="space-y-8">
            {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
              <div key={category}>
                <h3 className="mb-4 text-lg font-semibold border-b pb-2">
                  {category} ({categoryProducts.length})
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {categoryProducts.map((product) => (
                    <div
                      key={product.item_id}
                      className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-lg"
                    >
                      <ProductImage
                        src={product.image_url}
                        alt={product.name}
                        className="aspect-square rounded-md mb-4"
                        priority={false}
                      />
                      <div className="space-y-2">
                        <h3 className="font-semibold line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {product.sku}
                        </p>
                        {product.brand && (
                          <p className="text-xs text-primary">{product.brand}</p>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-lg font-bold text-primary">
                            {formatPrice(product.rate)} {currencyCode}
                          </span>
                          <span
                            className={`text-xs ${
                              product.stock_on_hand > 0 || product.available_stock > 0
                                ? "text-green-600"
                                : "text-red-500"
                            }`}
                          >
                            {product.stock_on_hand > 0 || product.available_stock > 0 ? t("inStock") : t("outOfStock")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Login CTA */}
      <div className="mt-8 rounded-lg border bg-muted/50 p-6 text-center">
        <h3 className="text-lg font-semibold">{t("wholesaleCta")}</h3>
        <p className="mt-2 text-muted-foreground">
          {t("wholesaleCtaDescription")}
        </p>
        <Button className="mt-4" asChild>
          <Link href={`/${locale}/login`}>{t("loginToAccount")}</Link>
        </Button>
      </div>
    </div>
  );
}
