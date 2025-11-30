"use client";

import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "./product-image";
import { useCart } from "@/components/providers/cart-provider";
import { Search, ShoppingCart, Plus, Minus, Check, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

// Pagination configuration
const PRODUCTS_PER_PAGE = 24;

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
  priceListName?: string;
  error?: string | null;
}

// Memoized Product Card Component with Add to Cart - Enhanced Design (Same as Public)
const ProductCardWithCart = memo(function ProductCardWithCart({
  product,
  currencyCode,
  locale,
}: {
  product: AuthenticatedProduct;
  currencyCode: string;
  locale: string;
}) {
  const t = useTranslations("products");
  const { addItem, getItemQuantity } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const isInStock = product.available_stock > 0;
  const isLowStock = product.available_stock > 0 && product.available_stock <= 5;
  const hasPrice = product.inPriceList !== false && product.rate > 0;
  const cartQuantity = getItemQuantity(product.item_id);
  const maxQuantity = Math.max(0, product.available_stock - cartQuantity);

  // Memoized add to cart handler for better performance
  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!hasPrice || !isInStock || maxQuantity <= 0) return;

    addItem(
      {
        item_id: product.item_id,
        name: product.name,
        sku: product.sku,
        rate: product.rate,
        image_url: product.image_url || null,
        available_stock: product.available_stock,
        unit: product.unit,
      },
      quantity
    );

    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setQuantity(1);
    }, 1500);
  }, [hasPrice, isInStock, maxQuantity, addItem, product, quantity]);

  // Memoized quantity change handler
  const handleQuantityChange = useCallback((e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= maxQuantity) {
      setQuantity(newQuantity);
    }
  }, [quantity, maxQuantity]);

  return (
    <Link
      href={`/${locale}/shop/${product.item_id}`}
      className="group block rounded-xl border bg-card card-hover overflow-hidden"
    >
      {/* Product Image with overlay */}
      <div className="relative img-hover-zoom">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="aspect-square"
          priority={false}
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Stock Badge - Enhanced */}
        <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3">
          <Badge
            variant={isInStock ? "success" : "destructive"}
            className={cn(
              "text-xs font-medium shadow-sm",
              isLowStock && "animate-pulse-soft"
            )}
          >
            {isInStock
              ? isLowStock
                ? t("lowStock")
                : t("inStock")
              : t("outOfStock")}
          </Badge>
        </div>

        {/* Category Tag */}
        {product.category_name && (
          <div className="absolute bottom-3 left-3 rtl:left-auto rtl:right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="px-2 py-1 text-xs font-medium bg-black/70 text-white rounded-md backdrop-blur-sm">
              {product.category_name}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Product Info */}
        <div className="space-y-2">
          {/* Product Name */}
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors duration-200">
            {product.name}
          </h3>

          {/* SKU & Brand */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">{product.sku}</span>
            {product.brand && (
              <span className="text-primary font-medium">{product.brand}</span>
            )}
          </div>

          {/* Price & Stock - Enhanced Layout */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-end justify-between">
              {/* Price */}
              <div>
                {hasPrice ? (
                  <>
                    <span className="price-tag text-xl text-primary">
                      {formatCurrency(product.rate, currencyCode)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    {t("contactForPrice")}
                  </span>
                )}
              </div>

              {/* Stock Count */}
              <div
                className={cn(
                  "stock-indicator text-xs font-medium",
                  isInStock
                    ? isLowStock
                      ? "stock-low text-amber-600 dark:text-amber-400"
                      : "stock-in text-emerald-600 dark:text-emerald-400"
                    : "stock-out text-red-500"
                )}
              >
                {isInStock
                  ? t("stockCount", { count: product.available_stock })
                  : t("outOfStock")}
              </div>
            </div>
          </div>
        </div>

        {/* Add to Cart Section - Enhanced */}
        {hasPrice && isInStock && maxQuantity > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50 space-y-3">
            {/* Quantity Selector - Refined */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full btn-press"
                onClick={(e) => handleQuantityChange(e, -1)}
                disabled={quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-10 text-center font-semibold text-lg">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full btn-press"
                onClick={(e) => handleQuantityChange(e, 1)}
                disabled={quantity >= maxQuantity}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Add to Cart Button - Enhanced */}
            <Button
              onClick={handleAddToCart}
              disabled={added || maxQuantity <= 0}
              className={cn(
                "w-full btn-press font-medium transition-all duration-300",
                added
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                  : "gradient-primary hover:opacity-90"
              )}
              size="sm"
            >
              {added ? (
                <span className="flex items-center justify-center gap-2 animate-scale-in">
                  <Check className="h-4 w-4" />
                  {t("addedToCart")}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  {t("addToCart")}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* View Details for non-purchasable items */}
        {(!hasPrice || !isInStock) && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <Button
              variant="outline"
              className="w-full btn-press group/btn"
              size="sm"
            >
              <Eye className="h-4 w-4 me-2 group-hover/btn:scale-110 transition-transform" />
              {t("viewDetails")}
            </Button>
          </div>
        )}
      </div>
    </Link>
  );
});

export function AuthenticatedProductsContent({
  products,
  currencyCode,
  error,
}: Omit<AuthenticatedProductsContentProps, 'categories'>) {
  const t = useTranslations("products");
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filter products by search and show only in-stock items
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p) => p.available_stock > 0);

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

    // Sort by name ascending by default
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [products, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of products
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (error && products.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
        <p className="text-yellow-600 dark:text-yellow-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("title")}</h2>
          <span className="text-xs text-muted-foreground">{currencyCode}</span>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Section */}
      {filteredProducts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {t("noProducts")}
        </div>
      ) : (
        <>
          {/* Showing X-Y of Z */}
          <div className="text-sm text-muted-foreground">
            {t("showing", {
              from: startIndex + 1,
              to: Math.min(endIndex, filteredProducts.length),
              total: filteredProducts.length,
            })}
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedProducts.map((product) => (
              <ProductCardWithCart
                key={product.item_id}
                product={product}
                currencyCode={currencyCode}
                locale={locale}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 space-y-4">
              {/* Page numbers - scrollable on mobile */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1 overflow-x-auto max-w-[70vw] sm:max-w-[500px] px-2 py-1 scrollbar-hide">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "min-w-[36px] h-9 px-2 shrink-0",
                        currentPage === page && "pointer-events-none"
                      )}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick jump - shows on larger page counts */}
              {totalPages > 10 && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t("goToPage") || "Go to page"}:</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder={String(currentPage)}
                    className="w-20 h-8 text-center"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const value = parseInt((e.target as HTMLInputElement).value);
                        if (value >= 1 && value <= totalPages) {
                          goToPage(value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <span className="text-muted-foreground">/ {totalPages}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
