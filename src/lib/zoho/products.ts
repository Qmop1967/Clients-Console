// ============================================
// Zoho Products/Items API - Server Only
// ============================================
// MIGRATION: Using Zoho Books API for products instead of Inventory
// Reason: Zoho Books has higher API rate limits than Zoho Inventory
// Books: ~100 requests/minute
// Inventory: ~3,750 requests/day (can be exhausted quickly)
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import { getUnifiedStockBulk, getStockCacheStatus } from './stock-cache';
import type { ZohoItem, ZohoCategory, PaginatedResponse } from '@/types';

// ============================================
// WAREHOUSE/LOCATION CONFIGURATION
// Stock should ONLY come from WholeSale WareHouse
// Using Accounting Stock > Available for Sale
// ============================================
const WHOLESALE_LOCATION_NAME = 'WholeSale WareHouse (Warehouse)';
const WHOLESALE_WAREHOUSE_ID = '2646610000000077024'; // For filtering list API

// ============================================
// ZOHO BOOKS API TYPES
// ============================================

interface ZohoBooksItem {
  item_id: string;
  name: string;
  description?: string;
  sku: string;
  rate: number;
  unit: string;
  status: string;
  item_type: string;
  product_type?: string;
  is_taxable?: boolean;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  purchase_rate?: number;
  account_id?: string;
  account_name?: string;
  purchase_account_id?: string;
  purchase_account_name?: string;
  // Stock fields from Books API
  stock_on_hand?: number;
  available_stock?: number;
  actual_available_stock?: number;
  committed_stock?: number;
  actual_committed_stock?: number;
  // Image fields
  image_name?: string;
  image_document_id?: string;
  // Category (Books uses category_id and category_name)
  category_id?: string;
  category_name?: string;
  // Brand
  brand?: string;
  manufacturer?: string;
  // Warehouse stock (Books may include this)
  warehouses?: Array<{
    warehouse_id: string;
    warehouse_name: string;
    warehouse_stock_on_hand: number;
    warehouse_available_stock: number;
    warehouse_actual_available_stock?: number;
    warehouse_committed_stock?: number;
  }>;
}

interface ZohoBooksItemsResponse {
  items: ZohoBooksItem[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages?: number;
  };
}

interface ZohoBooksSingleItemResponse {
  item: ZohoBooksItem;
}

interface ZohoBooksCategory {
  category_id: string;
  category_name: string;
  description?: string;
  is_inactive?: boolean;
  // Some additional fields Books might return
  parent_category_id?: string;
  depth?: number;
}

interface ZohoBooksCategoriesResponse {
  categories: ZohoBooksCategory[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract available stock from warehouse array (if present)
 * Zoho Books may include warehouse breakdown in item response
 */
function getWholesaleStockFromItem(item: ZohoBooksItem): number {
  // Check if item has warehouses array
  if (item.warehouses && item.warehouses.length > 0) {
    const wholesaleWarehouse = item.warehouses.find(
      (w) => w.warehouse_name === WHOLESALE_LOCATION_NAME || w.warehouse_id === WHOLESALE_WAREHOUSE_ID
    );

    if (wholesaleWarehouse) {
      // Use warehouse_available_stock (which is stock_on_hand - committed_stock)
      return wholesaleWarehouse.warehouse_available_stock ??
             wholesaleWarehouse.warehouse_actual_available_stock ??
             0;
    }
  }

  // Fallback to item-level stock
  // Books API returns available_stock at item level
  return item.available_stock ?? item.actual_available_stock ?? item.stock_on_hand ?? 0;
}

/**
 * Convert Zoho Books item to our ZohoItem type
 */
function booksItemToZohoItem(item: ZohoBooksItem): ZohoItem {
  return {
    item_id: item.item_id,
    name: item.name,
    description: item.description,
    sku: item.sku,
    rate: item.rate,
    unit: item.unit,
    status: item.status,
    item_type: item.item_type,
    product_type: item.product_type,
    is_taxable: item.is_taxable,
    tax_id: item.tax_id,
    tax_name: item.tax_name,
    tax_percentage: item.tax_percentage,
    purchase_rate: item.purchase_rate,
    stock_on_hand: item.stock_on_hand ?? 0,
    available_stock: getWholesaleStockFromItem(item),
    actual_available_stock: item.actual_available_stock,
    committed_stock: item.committed_stock,
    image_name: item.image_name,
    image_document_id: item.image_document_id,
    category_id: item.category_id,
    category_name: item.category_name,
    brand: item.brand ?? item.manufacturer,
  };
}

/**
 * Convert Zoho Books category to our ZohoCategory type
 */
function booksCategoryToZohoCategory(cat: ZohoBooksCategory): ZohoCategory {
  return {
    category_id: cat.category_id,
    name: cat.category_name,
    description: cat.description,
    is_active: !cat.is_inactive,
  };
}

// ============================================
// PRODUCTS API (Using Zoho Books)
// ============================================

/**
 * Get all items with pagination using Zoho Books API
 * Higher rate limits than Inventory API
 */
export async function getAllProducts(
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<ZohoItem>> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoBooksItemsResponse>('/items', {
        api: 'books', // Changed from 'inventory' to 'books'
        params: {
          page,
          per_page: perPage,
          filter_by: 'Status.Active',
          sort_column: 'name',
          sort_order: 'A',
        },
      })
    );

    const items = (data.items || []).map(booksItemToZohoItem);

    return {
      data: items,
      page_context: {
        page: data.page_context?.page ?? page,
        per_page: data.page_context?.per_page ?? perPage,
        has_more_page: data.page_context?.has_more_page ?? false,
        total: data.page_context?.total ?? items.length,
        total_pages: data.page_context?.total_pages ?? 1,
      },
    };
  } catch (error) {
    console.error('Error fetching all products:', error);
    return {
      data: [],
      page_context: {
        page: 1,
        per_page: perPage,
        has_more_page: false,
        total: 0,
        total_pages: 0,
      },
    };
  }
}

/**
 * Get all items with stock > 0 using Zoho Books API (cached)
 */
export const getProductsInStock = unstable_cache(
  async (page = 1, perPage = 50): Promise<PaginatedResponse<ZohoItem>> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoBooksItemsResponse>('/items', {
          api: 'books',
          params: {
            page,
            per_page: perPage,
            filter_by: 'Status.Active',
            sort_column: 'name',
            sort_order: 'A',
          },
        })
      );

      const allItems = (data.items || []).map(booksItemToZohoItem);

      // Filter items with stock > 0
      const itemsInStock = allItems.filter((item) => (item.available_stock ?? 0) > 0);

      return {
        data: itemsInStock,
        page_context: {
          page: data.page_context?.page ?? 1,
          per_page: data.page_context?.per_page ?? perPage,
          has_more_page: data.page_context?.has_more_page ?? false,
          total: data.page_context?.total ?? itemsInStock.length,
          total_pages: data.page_context?.total_pages ?? 1,
        },
      };
    } catch (error) {
      console.error('Error fetching products in stock:', error);
      return {
        data: [],
        page_context: {
          page: 1,
          per_page: perPage,
          has_more_page: false,
          total: 0,
          total_pages: 0,
        },
      };
    }
  },
  ['products-in-stock-books'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

/**
 * Get single product by ID using Zoho Books API
 */
export const getProduct = unstable_cache(
  async (itemId: string): Promise<ZohoItem | null> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoBooksSingleItemResponse>(`/items/${itemId}`, {
          api: 'books',
        })
      );

      if (!data.item) return null;

      return booksItemToZohoItem(data.item);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Re-throw rate limit errors so callers can handle them
      if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('blocked') || errorMsg.includes('exceeded')) {
        console.error('Rate limit error fetching product:', itemId);
        throw error;
      }
      console.error('Error fetching product:', error);
      return null;
    }
  },
  ['product-books'],
  {
    revalidate: 86400,
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

/**
 * Get product stock from Zoho Inventory API (warehouse-specific)
 * Use this when stock cache is not available
 */
export async function getProductWithInventoryStock(itemId: string): Promise<number> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<{
        item: {
          item_id: string;
          available_stock?: number;
          stock_on_hand?: number;
          locations?: Array<{
            location_id: string;
            location_name: string;
            location_available_for_sale_stock: number;
          }>;
        };
      }>(`/items/${itemId}`, {
        api: 'inventory',
      })
    );

    if (!data.item) return 0;

    // Check for warehouse-specific stock
    if (data.item.locations && data.item.locations.length > 0) {
      const wholesaleLocation = data.item.locations.find(
        (loc) => loc.location_name === WHOLESALE_LOCATION_NAME
      );
      if (wholesaleLocation) {
        console.log(`[getProductWithInventoryStock] ${itemId}: Found ${wholesaleLocation.location_available_for_sale_stock} in WholeSale WareHouse`);
        return wholesaleLocation.location_available_for_sale_stock || 0;
      }
    }

    // Fallback to item-level stock
    const stock = data.item.available_stock ?? data.item.stock_on_hand ?? 0;
    console.log(`[getProductWithInventoryStock] ${itemId}: Item-level stock = ${stock}`);
    return stock;
  } catch (error) {
    console.error('Error fetching product stock from Inventory API:', error);
    return 0;
  }
}

/**
 * Get categories using Zoho Books API
 */
export const getCategories = unstable_cache(
  async (): Promise<ZohoCategory[]> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoBooksCategoriesResponse>('/categories', {
          api: 'books',
        })
      );

      return (data.categories || []).map(booksCategoryToZohoCategory);
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },
  ['categories-books'],
  {
    revalidate: 86400,
    tags: [CACHE_TAGS.CATEGORIES],
  }
);

/**
 * Get products by category using Zoho Books API
 */
export async function getProductsByCategory(
  categoryId: string,
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<ZohoItem>> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoBooksItemsResponse>('/items', {
        api: 'books',
        params: {
          page,
          per_page: perPage,
          category_id: categoryId,
          filter_by: 'Status.Active',
        },
      })
    );

    const items = (data.items || []).map(booksItemToZohoItem);

    return {
      data: items,
      page_context: {
        page: data.page_context?.page ?? 1,
        per_page: data.page_context?.per_page ?? perPage,
        has_more_page: data.page_context?.has_more_page ?? false,
        total: data.page_context?.total ?? items.length,
        total_pages: data.page_context?.total_pages ?? 1,
      },
    };
  } catch (error) {
    console.error('Error fetching products by category:', error);
    return {
      data: [],
      page_context: {
        page: 1,
        per_page: perPage,
        has_more_page: false,
        total: 0,
        total_pages: 0,
      },
    };
  }
}

/**
 * Search products using Zoho Books API
 */
export async function searchProducts(
  query: string,
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<ZohoItem>> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoBooksItemsResponse>('/items', {
        api: 'books',
        params: {
          page,
          per_page: perPage,
          search_text: query,
          filter_by: 'Status.Active',
        },
      })
    );

    const items = (data.items || []).map(booksItemToZohoItem);

    return {
      data: items,
      page_context: {
        page: data.page_context?.page ?? 1,
        per_page: data.page_context?.per_page ?? perPage,
        has_more_page: data.page_context?.has_more_page ?? false,
        total: data.page_context?.total ?? items.length,
        total_pages: data.page_context?.total_pages ?? 1,
      },
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return {
      data: [],
      page_context: {
        page: 1,
        per_page: perPage,
        has_more_page: false,
        total: 0,
        total_pages: 0,
      },
    };
  }
}

/**
 * Simple hash function for cache busting
 * Creates a short hash from image identifiers
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to base36 and take last 8 chars for a short hash
  return Math.abs(hash).toString(36).slice(-8);
}

/**
 * Get product image URL with cache-busting version parameter
 * Uses our proxy API route to fetch images with OAuth authentication
 *
 * The version parameter (v) is based on image_document_id and image_name,
 * so when the image changes in Zoho, the URL changes and caches are invalidated.
 */
export function getProductImageUrl(item: ZohoItem): string | null {
  if (item.image_document_id || item.image_name) {
    // Create version hash from image identifiers for cache busting
    const versionSource = `${item.image_document_id || ''}_${item.image_name || ''}`;
    const version = simpleHash(versionSource);
    return `/api/zoho/images/${item.item_id}?v=${version}`;
  }
  return null;
}

// ============================================
// FETCH ALL PRODUCTS (with full pagination)
// Uses Zoho Books API for higher rate limits
// ============================================

/**
 * Internal helper to fetch all products from Zoho Books API
 * Returns products WITHOUT stock data (stock is merged separately for freshness)
 */
async function fetchAllProductsFromBooks(): Promise<ZohoItem[]> {
  const allProducts: ZohoItem[] = [];
  let currentPage = 1;
  const perPage = 200; // Max per page for efficiency
  let hasMorePages = true;

  try {
    if (process.env.NODE_ENV === 'development') console.log('[Products] Fetching all from Zoho Books API...');

    while (hasMorePages) {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoBooksItemsResponse>('/items', {
          api: 'books', // Using Books API instead of Inventory
          params: {
            page: currentPage,
            per_page: perPage,
            filter_by: 'Status.Active',
            sort_column: 'name',
            sort_order: 'A',
          },
        })
      );

      if (data.items && data.items.length > 0) {
        const items = data.items.map(booksItemToZohoItem);
        allProducts.push(...items);
        if (process.env.NODE_ENV === 'development') console.log(`[Products] Page ${currentPage}: ${data.items.length} items (total: ${allProducts.length})`);
      }

      hasMorePages = data.page_context?.has_more_page ?? false;
      currentPage++;

      if (currentPage > 50) {
        console.warn('Reached max page limit (50) when fetching products');
        break;
      }
    }

    if (process.env.NODE_ENV === 'development') console.log(`[Products] Fetched ${allProducts.length} total products from Zoho Books API`);
    return allProducts;
  } catch (error) {
    console.error('Error fetching all products:', error);
    return [];
  }
}

/**
 * Get all products METADATA only (cached for 24 hours)
 * Stock is fetched separately from Redis for freshness in getAllProductsComplete()
 *
 * SAFEGUARD: Will throw error if API returns 0 products to prevent caching empty results
 * This ensures the cache never holds invalid data.
 */
export const getAllProductsMetadata = unstable_cache(
  async (): Promise<ZohoItem[]> => {
    const products = await fetchAllProductsFromBooks();

    // SAFEGUARD: Never cache empty results!
    // If API returns 0 products, throw an error so unstable_cache doesn't cache it
    if (products.length === 0) {
      console.error('[getAllProductsMetadata] API returned 0 products - NOT caching empty result');
      throw new Error('SAFEGUARD: Refusing to cache empty product list');
    }

    console.log(`[getAllProductsMetadata] Caching ${products.length} products`);
    return products;
  },
  ['all-products-metadata-books'],
  {
    revalidate: 86400, // 24 hours - products rarely change
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

/**
 * Safe wrapper that handles cache miss gracefully
 * Falls back to direct API call if cache throws
 */
export async function getProductsMetadataSafe(): Promise<ZohoItem[]> {
  try {
    return await getAllProductsMetadata();
  } catch (error) {
    console.warn('[getProductsMetadataSafe] Cache miss or error, fetching directly from API...');
    const products = await fetchAllProductsFromBooks();
    return products;
  }
}

/**
 * Get all products with stock data
 *
 * Stock priority:
 * 1. Redis cache (warehouse-specific, most accurate)
 * 2. Zoho Books item-level stock (fallback when Redis incomplete)
 * 3. 0 (final fallback)
 *
 * This ensures products are always visible even when Redis cache is incomplete,
 * while preferring the accurate warehouse-specific stock from Redis when available.
 *
 * SAFEGUARDS:
 * - If Redis cache is empty, uses Books stock directly (never returns 0 for all)
 * - Logs warnings for monitoring when cache coverage is low
 */
export async function getAllProductsComplete(): Promise<ZohoItem[]> {
  try {
    // Step 1: Get cached product metadata (includes Zoho Books stock as fallback)
    // Uses safe wrapper that falls back to direct API call on cache error
    const products = await getProductsMetadataSafe();

    if (products.length === 0) {
      console.error('[getAllProductsComplete] No products from metadata cache!');
      return [];
    }

    // Step 2: Get cache status first to determine strategy
    const cacheStatus = await getStockCacheStatus();

    // SAFEGUARD: If Redis cache is empty or very stale, use Books stock directly
    if (!cacheStatus.exists || cacheStatus.itemCount === 0) {
      console.warn('[getAllProductsComplete] Redis stock cache is EMPTY - using Zoho Books stock as fallback');
      // Return products with their original Zoho Books stock
      const productsWithBooksStock = products.map((item) => ({
        ...item,
        available_stock: item.available_stock ?? 0,
      }));
      const inStockCount = productsWithBooksStock.filter(p => (p.available_stock ?? 0) > 0).length;
      console.log(`[getAllProductsComplete] Using Books stock: ${inStockCount}/${products.length} in stock`);
      return productsWithBooksStock;
    }

    // Step 3: Get stock from Redis cache (warehouse-specific)
    const itemIds = products.map(item => item.item_id);
    const stockMap = await getUnifiedStockBulk(itemIds, {
      context: 'shop-list',
    });

    // Calculate statistics for monitoring
    let redisHits = 0;
    let booksHits = 0;

    // Step 4: Merge stock with products
    // Priority: Redis cache > Zoho Books stock > 0
    const productsWithStock = products.map((item) => {
      const redisStock = stockMap.get(item.item_id);
      const hasRedisData = stockMap.has(item.item_id) && redisStock !== undefined;

      // IMPROVED: Use Redis if available, otherwise fall back to Books stock
      let finalStock: number;
      if (hasRedisData && redisStock !== undefined) {
        finalStock = redisStock;
        if (redisStock > 0) redisHits++;
      } else {
        // Fallback to Books stock
        finalStock = item.available_stock ?? 0;
        if (finalStock > 0) booksHits++;
      }

      return {
        ...item,
        available_stock: finalStock,
      };
    });

    // Log statistics
    const totalWithStock = redisHits + booksHits;
    console.log(`[getAllProductsComplete] Stock sources - Redis: ${redisHits}, Books fallback: ${booksHits}, Total in-stock: ${totalWithStock}/${products.length}, cache items: ${cacheStatus.itemCount}`);

    // SAFEGUARD: If somehow all products have 0 stock, log critical error
    if (totalWithStock === 0 && products.length > 0) {
      console.error('[CRITICAL] getAllProductsComplete: ALL products showing 0 stock! Check stock sync.');
    }

    return productsWithStock;
  } catch (error) {
    console.error('Error in getAllProductsComplete:', error);
    return [];
  }
}

/**
 * Get total product count using Zoho Books API
 */
export const getProductCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoBooksItemsResponse>('/items', {
          api: 'books',
          params: {
            page: 1,
            per_page: 1,
            filter_by: 'Status.Active',
          },
        })
      );

      return data.page_context?.total ?? 0;
    } catch (error) {
      console.error('Error fetching product count:', error);
      return 0;
    }
  },
  ['product-count-books'],
  {
    revalidate: 86400,
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

// ============================================
// LEGACY EXPORTS (for backward compatibility)
// These functions use Inventory API when needed
// ============================================

interface ZohoWarehouse {
  warehouse_id: string;
  warehouse_name: string;
  status: string;
  is_primary: boolean;
}

interface ZohoWarehousesResponse {
  warehouses: ZohoWarehouse[];
}

/**
 * Get all warehouses (uses Inventory API - rarely called)
 */
export const getWarehouses = unstable_cache(
  async (): Promise<ZohoWarehouse[]> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoWarehousesResponse>('/warehouses', {
          api: 'inventory', // Warehouses only exist in Inventory API
        })
      );
      return data.warehouses || [];
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      return [];
    }
  },
  ['warehouses'],
  {
    revalidate: 86400 * 7, // 7 days - warehouses rarely change
    tags: ['warehouses'],
  }
);

/**
 * Get WholeSale WareHouse ID
 */
export const getWholesaleWarehouseId = unstable_cache(
  async (): Promise<string | null> => {
    try {
      const warehouses = await getWarehouses();
      const wholesaleWarehouse = warehouses.find(
        (w) => w.warehouse_name === WHOLESALE_LOCATION_NAME
      );
      if (wholesaleWarehouse) {
        return wholesaleWarehouse.warehouse_id;
      }
      return WHOLESALE_WAREHOUSE_ID; // Fallback to hardcoded ID
    } catch (error) {
      console.error('Error getting wholesale warehouse ID:', error);
      return WHOLESALE_WAREHOUSE_ID;
    }
  },
  ['wholesale-warehouse-id'],
  {
    revalidate: 86400 * 7,
    tags: ['warehouses'],
  }
);

// Stock batch functions - kept for sync endpoints
export async function fetchAccurateStockBatch(
  items: ZohoItem[]
): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  items.forEach(item => {
    stockMap.set(item.item_id, item.available_stock ?? 0);
  });
  return stockMap;
}

export async function fetchAccurateStockBatchOptimized(
  items: ZohoItem[]
): Promise<Map<string, number>> {
  return fetchAccurateStockBatch(items);
}

// ============================================
// OPTIMIZED: Products + Prices Combined Cache
// ============================================
// Fetches products and prices together, cached per price list
// Eliminates 13+ API calls per shop page load
// ============================================

interface ZohoItemWithPrice extends ZohoItem {
  display_price: number;
  price_currency: string;
  in_price_list: boolean;
}

interface ZohoPricebookRateResponse {
  items: Array<{
    item_id: string;
    name: string;
    rate: number;
    pricebook_rate: number;
    sales_rate?: number;
  }>;
}

/**
 * Fetch prices for items from a pricebook (internal helper)
 */
async function fetchPricesForItems(
  pricebookId: string,
  itemIds: string[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  if (!itemIds.length) return priceMap;

  const batchSize = 100;
  const concurrencyLimit = 3;

  // Create batches
  const batches: string[][] = [];
  for (let i = 0; i < itemIds.length; i += batchSize) {
    batches.push(itemIds.slice(i, i + batchSize));
  }

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const batchChunk = batches.slice(i, i + concurrencyLimit);

    const results = await Promise.all(
      batchChunk.map(async (batchIds) => {
        try {
          const data = await rateLimitedFetch(() =>
            zohoFetch<ZohoPricebookRateResponse>('/items/pricebookrate', {
              api: 'books',
              params: {
                pricebook_id: pricebookId,
                item_ids: batchIds.join(','),
                sales_or_purchase_type: 'sales',
              },
            })
          );

          return data.items || [];
        } catch (error) {
          console.error('Error fetching pricebook rates batch:', error);
          return [];
        }
      })
    );

    // Add prices to map
    results.flat().forEach(item => {
      priceMap.set(item.item_id, item.pricebook_rate ?? item.rate ?? 0);
    });
  }

  return priceMap;
}

/**
 * Get all products with prices for a specific price list
 * CACHED per price list ID for 24 hours
 *
 * This eliminates ~13 API calls per shop page load by caching
 * products and prices together.
 *
 * IMPORTANT: Each price list gets its own cache entry via dynamic cache key.
 * This ensures IQD customers see IQD prices and USD customers see USD prices.
 */
export async function getProductsWithPrices(priceListId: string): Promise<{
  products: ZohoItemWithPrice[];
  currency: string;
  priceListName: string;
}> {
  // Create a cached function with DYNAMIC cache key per price list
  // This is critical - without including priceListId in the cache key,
  // all customers would see the same cached prices regardless of their price list!
  const cachedFetch = unstable_cache(
    async (): Promise<{
      products: ZohoItemWithPrice[];
      currency: string;
      priceListName: string;
    }> => {
      console.log(`[getProductsWithPrices] Fetching for price list ${priceListId}`);

      try {
        // Get all products (uses its own cache)
        const products = await getAllProductsComplete();

        if (!products.length) {
          console.warn('[Products] No products found');
          return { products: [], currency: 'IQD', priceListName: 'Unknown' };
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Products] Got ${products.length} products, now fetching prices...`);
        }

        // Fetch prices for all product IDs
        const itemIds = products.map(p => p.item_id);
        const priceMap = await fetchPricesForItems(priceListId, itemIds);

        console.log(`[getProductsWithPrices] Got prices for ${priceMap.size} items`);

        // Get price list info for currency
        const priceListInfo = await rateLimitedFetch(() =>
          zohoFetch<{ pricebook: { name: string; currency_code: string } }>(`/pricebooks/${priceListId}`, {
            api: 'books',
          })
        ).catch(() => ({ pricebook: { name: 'Unknown', currency_code: 'IQD' } }));

        const currency = priceListInfo.pricebook?.currency_code || 'IQD';
        const priceListName = priceListInfo.pricebook?.name || 'Unknown';

        // Merge products with prices
        const productsWithPrices: ZohoItemWithPrice[] = products.map(product => ({
          ...product,
          display_price: priceMap.get(product.item_id) || 0,
          price_currency: currency,
          in_price_list: priceMap.has(product.item_id),
        }));

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Products] Returning ${productsWithPrices.length} products with prices`);
        }

        return {
          products: productsWithPrices,
          currency,
          priceListName,
        };
      } catch (error) {
        console.error('[getProductsWithPrices] Error:', error);
        return { products: [], currency: 'IQD', priceListName: 'Unknown' };
      }
    },
    [`products-with-prices-${priceListId}`], // DYNAMIC cache key per price list!
    {
      revalidate: 86400, // 24 hours
      tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.PRICE_LISTS],
    }
  );

  return cachedFetch();
}

/**
 * Get products with consumer prices (for public visitors)
 * Convenience wrapper with pre-set consumer price list
 */
export async function getProductsWithConsumerPrices(): Promise<{
  products: ZohoItemWithPrice[];
  currency: string;
  priceListName: string;
}> {
  const CONSUMER_PRICE_LIST_ID = '2646610000049149103';
  return getProductsWithPrices(CONSUMER_PRICE_LIST_ID);
}
