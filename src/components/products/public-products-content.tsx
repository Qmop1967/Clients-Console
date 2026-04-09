"use client";

import { useState, useMemo, useEffect, useCallback, memo, useRef, useDeferredValue } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductImage } from "./product-image";
import { useCart } from "@/components/providers/cart-provider";
import { useCatalogMode } from "@/components/providers/catalog-mode-provider";
import { Search, ShoppingCart, Check, Eye, ChevronRight, X, SlidersHorizontal, MessageCircle } from "lucide-react";
import { NumberedPagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

// PERF: Lazy load quantity input - not needed for LCP, reduces initial JS bundle
const WholesaleQuantityInput = dynamic(
  () => import("@/components/ui/wholesale-quantity-input").then(mod => ({ default: mod.WholesaleQuantityInput })),
  { ssr: false, loading: () => <div className="h-[120px]" /> }
);

// Session storage key for scroll position
const SCROLL_POSITION_KEY = "shop_scroll_position";

// Pagination configuration - 24 items per page (6 rows of 4 on desktop)
const PRODUCTS_PER_PAGE = 24;

// Sort options
type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-desc";

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
  selectedCategory?: string | null;
  selectedCategoryName?: string | null;
  onClearCategory?: () => void;
}

// LCP OPTIMIZATION: Reduced from 4 to 2 priority products
// On mobile, only 2 products are above-the-fold
// Fewer priority images = less bandwidth contention = faster LCP
const PRIORITY_PRODUCTS_COUNT = 2;

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
  const tCatalog = useTranslations("catalogMode");
  const { addItem, getItemQuantity } = useCart();
  const { isCatalogMode, showCatalogModal } = useCatalogMode();
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
      className={cn(
        "group block rounded-2xl border bg-card overflow-hidden native-press transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:-translate-y-0.5",
        // LCP OPTIMIZATION: Skip rendering below-fold cards until scrolled into view
        !priority && "content-auto"
      )}
    >
      {/* Product Image with overlay */}
      <div className="relative overflow-hidden">
        {/* LCP OPTIMIZATION: sizes must match grid layout (grid-cols-2 on mobile = 50vw) */}
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="aspect-square"
          priority={priority}
          sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Category Tag */}
        {product.category_name && (
          <div className="absolute bottom-3 left-3 rtl:left-auto rtl:right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="px-2 py-1 text-xs font-medium bg-black/70 text-white rounded-md backdrop-blur-sm">
              {product.category_name}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4">
        {/* Product Info */}
        <div className="space-y-1.5 sm:space-y-2">
          {/* Product Name */}
          <h2 className="font-semibold text-xs sm:text-sm line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-primary transition-colors duration-200">
            {product.name}
          </h2>

          {/* SKU & Brand */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
            <span className="font-mono truncate max-w-[60%]">{product.sku}</span>
            {product.brand && (
              <span className="text-primary font-medium truncate">{product.brand}</span>
            )}
          </div>

          {/* Price & Stock - Hidden in catalog mode */}
          {!isCatalogMode && (
            <div className="pt-2 sm:pt-3 border-t border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
                {/* Price */}
                <div>
                  {hasPrice ? (
                    <>
                      <span className="price-tag text-base sm:text-xl text-primary">
                        {formatCurrency(product.rate, currencyCode)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs sm:text-sm text-muted-foreground italic">
                      {t("contactForPrice")}
                    </span>
                  )}
                </div>

                {/* Stock Count */}
                <div
                  className={cn(
                    "stock-indicator text-[10px] sm:text-xs font-medium",
                    isInStock
                      ? isLowStock
                        ? "stock-low text-amber-700 dark:text-amber-400"
                        : "stock-in text-emerald-700 dark:text-emerald-400"
                      : "stock-out text-red-600"
                  )}
                >
                  {isInStock
                    ? t("stockCount", { count: product.available_stock })
                    : t("outOfStock")}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Catalog Mode - Contact Sales Button */}
        {isCatalogMode && (
          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-border/50">
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                showCatalogModal();
              }}
              variant="outline"
              className="w-full btn-press"
              size="sm"
            >
              <MessageCircle className="h-4 w-4 me-2" />
              {tCatalog("contactSales")}
            </Button>
          </div>
        )}

        {/* Add to Cart Section - Wholesale Enhanced (hidden in catalog mode) */}
        {!isCatalogMode && hasPrice && isInStock && maxQuantity > 0 && (
          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-border/50 space-y-2 sm:space-y-3">
            {/* Wholesale Quantity Input */}
            <WholesaleQuantityInput
              value={quantity}
              onChange={handleQuantityChange}
              max={maxQuantity}
              translations={{
                max: t("maxQuantity"),
                available: t("availableStock"),
                exceededMax: t("exceededMaxQuantity", { count: maxQuantity }),
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

        {/* View Details for non-purchasable items (hidden in catalog mode) */}
        {!isCatalogMode && (!hasPrice || !isInStock) && (
          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-border/50">
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
  // categories is passed for potential future use (e.g., category dropdown filter)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  categories,
  currencyCode,
  selectedCategory = null,
  selectedCategoryName = null,
  onClearCategory,
}: PublicProductsContentProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialMount = useRef(true);

  // PERFORMANCE: Check auth client-side to keep server render cacheable
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  // Get page from URL params, default to 1
  const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);
  const searchFromUrl = searchParams.get("q") || "";
  const sortFromUrl = (searchParams.get("sort") as SortOption) || "name-asc";

  const [searchQuery, setSearchQuery] = useState(searchFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [sortBy, setSortBy] = useState<SortOption>(sortFromUrl);

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

  // Update URL when page, search, or sort changes (without full navigation)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (currentPage > 1) {
      params.set("page", String(currentPage));
    } else {
      params.delete("page");
    }

    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }

    if (sortBy !== "name-asc") {
      params.set("sort", sortBy);
    } else {
      params.delete("sort");
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, "", newUrl);
  }, [currentPage, searchQuery, sortBy, pathname, searchParams]);

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    if (searchQuery !== searchFromUrl || sortBy !== sortFromUrl) {
      setCurrentPage(1);
    }
  }, [searchQuery, searchFromUrl, sortBy, sortFromUrl]);

  // Filter and sort products
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

    // Sort based on selected option
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
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, deferredSearchQuery, sortBy]);

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
      {/* Filters Row */}
      <div className="flex flex-col gap-4">
        {/* Search and Sort Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className={cn(
              "absolute left-3 rtl:left-auto rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-opacity",
              isSearching && "animate-pulse"
            )} aria-hidden="true" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
              aria-label={t("searchPlaceholder")}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" aria-hidden="true" />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-full sm:w-[180px]" aria-label={t("sortBy")}>
                <SelectValue placeholder={t("sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">{t("sortOptions.nameAsc")}</SelectItem>
                <SelectItem value="name-desc">{t("sortOptions.nameDesc")}</SelectItem>
                <SelectItem value="price-asc">{t("sortOptions.priceAsc")}</SelectItem>
                <SelectItem value="price-desc">{t("sortOptions.priceDesc")}</SelectItem>
                <SelectItem value="stock-desc">{t("sortOptions.stockDesc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Category Badge */}
        {selectedCategory && selectedCategoryName && onClearCategory && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("activeFilters")}:</span>
            <Badge
              variant="gold"
              className="gap-1.5 pe-1.5 cursor-pointer hover:bg-gold/80 transition-colors"
              onClick={onClearCategory}
            >
              {selectedCategoryName}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearCategory();
                }}
                className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                aria-label={t("clearFilter")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
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

            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              <span className="text-gradient">{t("wholesaleCta")}</span>
            </h2>

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
