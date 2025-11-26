"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductFilters } from "./product-filters";
import { ProductImage } from "./product-image";
import { Search, Filter, Grid, List, ShoppingCart } from "lucide-react";

// Product type from server (with customer pricing)
interface AuthenticatedProduct {
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
interface Category {
  category_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface AuthenticatedProductsContentProps {
  products: AuthenticatedProduct[];
  categories: Category[];
  currencyCode: string;
  priceListName: string;
  error?: string | null;
}

export function AuthenticatedProductsContent({
  products,
  categories,
  currencyCode,
  priceListName,
  error,
}: AuthenticatedProductsContentProps) {
  const t = useTranslations("products");
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
      filtered = filtered.filter((p) => p.available_stock > 0);
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
          return b.available_stock - a.available_stock;
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, inStockOnly, sortBy]);

  // Products grouped by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, AuthenticatedProduct[]> = {};
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
      maximumFractionDigits: currencyCode === "USD" ? 2 : 0,
    }).format(price);
  };

  // Handle add to cart (placeholder for future implementation)
  const handleAddToCart = (product: AuthenticatedProduct) => {
    console.log("Add to cart:", product);
    // TODO: Implement cart functionality
  };

  if (error && products.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
        <p className="text-yellow-600 dark:text-yellow-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Price List Info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {priceListName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {currencyCode}
            </span>
          </div>
        </div>
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
                  {/* Product Image */}
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
                        {product.inPriceList !== false && product.rate > 0
                          ? `${formatPrice(product.rate)} ${currencyCode}`
                          : t("contactForPrice")}
                      </span>
                      <span
                        className={`text-xs ${
                          product.available_stock > 0
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {product.available_stock > 0
                          ? t("stockCount", { count: product.available_stock })
                          : t("outOfStock")}
                      </span>
                    </div>
                    {product.category_name && (
                      <p className="text-xs text-muted-foreground">
                        {product.category_name}
                      </p>
                    )}

                    {/* Add to Cart Button - Only show if product has price and is in stock */}
                    {product.inPriceList !== false &&
                      product.rate > 0 &&
                      product.available_stock > 0 && (
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => handleAddToCart(product)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {t("addToCart")}
                        </Button>
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
                            {product.inPriceList !== false && product.rate > 0
                              ? `${formatPrice(product.rate)} ${currencyCode}`
                              : t("contactForPrice")}
                          </span>
                          <span
                            className={`text-xs ${
                              product.available_stock > 0
                                ? "text-green-600"
                                : "text-red-500"
                            }`}
                          >
                            {product.available_stock > 0 ? t("inStock") : t("outOfStock")}
                          </span>
                        </div>
                        {/* Add to Cart Button */}
                        {product.inPriceList !== false &&
                          product.rate > 0 &&
                          product.available_stock > 0 && (
                            <Button
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => handleAddToCart(product)}
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              {t("addToCart")}
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
