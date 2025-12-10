"use client";

import { useState, useMemo, useEffect, useCallback, memo, useRef, useDeferredValue } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "./product-image";
import { useCart } from "@/components/providers/cart-provider";
import { Search, ShoppingCart, Check, Eye, ChevronRight } from "lucide-react";
import { WholesaleQuantityInput } from "@/components/ui/wholesale-quantity-input";
import { NumberedPagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

// Session storage key for scroll position
const SCROLL_POSITION_KEY = "shop_scroll_position";

// Pagination configuration - 24 items per page (6 rows of 4 on desktop)
const PRODUCTS_PER_PAGE = 24;

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
  inPriceList?: boolean; // Whether item has a price in the Consumer price list
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
  isAuthenticated?: boolean; // Hide login CTA for authenticated users
}

// Number of products to load with priority (above-the-fold)
// Reduced to 4 for faster LCP - only first row on most screens
const PRIORITY_PRODUCTS_COUNT = 4;

// Memoized Product Card Component with Add to Cart - Enhanced Design
const ProductCardWithCart = memo(function ProductCardWithCart({
  product,
  currencyCode,
  locale,
  priority = false,
}: {
  product: PublicProduct;
  currencyCode: string;
  locale: string;
  priority?: boolean;
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

  // Handler to prevent navigation when interacting with quantity input
  const preventNavigation = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handler for quantity change from input component
  const handleQuantityChange = useCallback((newQuantity: number) => {
    setQuantity(newQuantity);
  }, []);

  // Save scroll position before navigating to product detail
  const handleCardClick = useCallback(() => {
    sessionStorage.setItem(SCROLL_POSITION_KEY, String(window.scrollY));
  }, []);

  return (
    <Link
      href={`/${locale}/shop/${product.item_id}`}
      onClick={handleCardClick}
      className="group block rounded-2xl border bg-card overflow-hidden native-press transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Product Image with overlay */}
      <div className="relative overflow-hidden">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="aspect-square"
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
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

        {/* Add to Cart Section - Wholesale Enhanced */}
        {hasPrice && isInStock && maxQuantity > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50 space-y-3">
            {/* Wholesale Quantity Input */}
            <WholesaleQuantityInput
              value={quantity}
              onChange={handleQuantityChange}
              max={maxQuantity}
              translations={{
                max: t("maxQuantity"),
                available: t("availableStock"),
              }}
              onPreventNavigation={preventNavigation}
            />

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

export function PublicProductsContent({
  products,
  currencyCode,
  isAuthenticated = false,
}: Omit<PublicProductsContentProps, 'categories'>) {
  const t = useTranslations("products");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialMount = useRef(true);

  // Get page from URL params, default to 1
  const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);
  const searchFromUrl = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(searchFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);

  // Use deferred value for search to keep input responsive (improves INP)
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearching = searchQuery !== deferredSearchQuery;

  // Restore scroll position on mount (when coming back from product page)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const savedScrollPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
      if (savedScrollPosition) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedScrollPosition, 10));
        }, 100);
        // Clear after restoring
        sessionStorage.removeItem(SCROLL_POSITION_KEY);
      }
    }
  }, []);

  // Update URL when page or search changes (without full navigation)
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set("page", String(currentPage));
    if (searchQuery) params.set("q", searchQuery);

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, "", newUrl);
  }, [currentPage, searchQuery, pathname]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (searchQuery !== searchFromUrl) {
      setCurrentPage(1);
    }
  }, [searchQuery, searchFromUrl]);

  // STRICT RULE: Only show products with WholeSale warehouse stock > 0
  // Uses deferred search query for responsive input (improves INP)
  const filteredProducts = useMemo(() => {
    // First filter: ONLY products with stock > 0 (strict rule)
    let filtered = products.filter((p) => p.available_stock > 0);

    // Search filter - uses deferred value for responsiveness
    if (deferredSearchQuery) {
      const query = deferredSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query)
      );
    }

    // Sort by name (all products are in-stock now)
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [products, deferredSearchQuery]);

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

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">{t("title")}</h2>

        {/* Search Bar - optimized with deferred value for INP */}
        <div className="relative w-full sm:w-80">
          <Search className={cn(
            "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-opacity",
            isSearching && "animate-pulse"
          )} />
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
          {/* Results Count & Pagination ABOVE products */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {t("showing", {
                from: startIndex + 1,
                to: Math.min(endIndex, filteredProducts.length),
                total: filteredProducts.length,
              })}
            </div>

            {/* Pagination Above Products */}
            <NumberedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedProducts.map((product, index) => (
              <ProductCardWithCart
                key={product.item_id}
                product={product}
                currencyCode={currencyCode}
                locale={locale}
                priority={currentPage === 1 && index < PRIORITY_PRODUCTS_COUNT}
              />
            ))}
          </div>

          {/* Pagination BELOW products */}
          <NumberedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            className="mt-8"
          />
        </>
      )}

      {/* Login CTA - Only show for non-authenticated users */}
      {!isAuthenticated && (
        <div className="mt-12 relative overflow-hidden rounded-2xl gradient-hero border border-primary/20">
          {/* Decorative elements */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
          </div>

          <div className="relative p-8 md:p-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t("wholesaleCta")}
            </div>

            <h3 className="text-2xl md:text-3xl font-bold mb-3">
              <span className="text-gradient">{t("wholesaleCta")}</span>
            </h3>

            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              {t("wholesaleCtaDescription")}
            </p>

            <Button
              className="gradient-primary text-white hover:opacity-90 btn-press px-8 py-6 text-base font-medium"
              asChild
            >
              <Link href={`/${locale}/login`} className="flex items-center gap-2">
                {t("loginToAccount")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
