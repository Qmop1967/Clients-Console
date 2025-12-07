// ============================================
// Stock Cache System
// ============================================
// Caches warehouse-specific stock in Upstash Redis
// This ensures listing and detail pages show consistent stock
// ============================================

import { zohoFetch, rateLimitedFetch } from './client';

// Redis key for stock cache
const STOCK_CACHE_KEY = 'stock:wholesale_map';
const STOCK_CACHE_TTL = 1800; // 30 minutes in seconds
const STOCK_SYNC_LOCK_KEY = 'stock:sync_lock';
const STOCK_SYNC_LOCK_TTL = 600; // 10 minutes lock

// Warehouse configuration
const WHOLESALE_LOCATION_NAME = 'WholeSale WareHouse (Warehouse)';
const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

// Types
interface ZohoItemLocationStock {
  location_id: string;
  location_name: string;
  location_stock_on_hand: number;
  location_available_stock: number;
  location_available_for_sale_stock: number;
  location_committed_stock: number;
}

interface ZohoItemWithLocations {
  item_id: string;
  name: string;
  available_stock?: number;
  locations?: ZohoItemLocationStock[];
}

interface ZohoSingleItemResponse {
  item: ZohoItemWithLocations;
}

interface ZohoItemsResponse {
  items: ZohoItemWithLocations[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

interface StockMap {
  [itemId: string]: number;
}

interface StockCacheData {
  stock: StockMap;
  updatedAt: number;
  itemCount: number;
}

// ============================================
// Upstash Redis REST API Helpers
// ============================================

function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisGet<T>(key: string): Promise<T | null> {
  if (!isUpstashConfigured()) return null;

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.result) {
      return JSON.parse(data.result) as T;
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Failed to get from Redis:', error);
    return null;
  }
}

async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
  if (!isUpstashConfigured()) return false;

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/setex/${key}/${ttlSeconds}/${encodeURIComponent(JSON.stringify(value))}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.warn('⚠️ Failed to set in Redis:', error);
    return false;
  }
}

async function redisSetNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  if (!isUpstashConfigured()) return false;

  try {
    // Use SET with NX and EX options for atomic lock
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', key, value, 'NX', 'EX', ttlSeconds.toString()]),
      }
    );

    if (!response.ok) return false;

    const data = await response.json();
    return data.result === 'OK';
  } catch (error) {
    console.warn('⚠️ Failed to setnx in Redis:', error);
    return false;
  }
}

async function redisDel(key: string): Promise<boolean> {
  if (!isUpstashConfigured()) return false;

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/del/${key}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.warn('⚠️ Failed to delete from Redis:', error);
    return false;
  }
}

// ============================================
// Stock Extraction Helper
// ============================================

function getWholesaleAvailableStock(item: ZohoItemWithLocations): number {
  if (item.locations && item.locations.length > 0) {
    const wholesaleLocation = item.locations.find(
      (loc) => loc.location_name === WHOLESALE_LOCATION_NAME
    );

    if (wholesaleLocation) {
      return wholesaleLocation.location_available_for_sale_stock || 0;
    }
    return 0;
  }
  return item.available_stock || 0;
}

// ============================================
// Public API
// ============================================

/**
 * Get cached stock map from Redis
 * Returns null if not cached or expired
 */
export async function getStockCache(): Promise<StockCacheData | null> {
  const cached = await redisGet<StockCacheData>(STOCK_CACHE_KEY);

  if (cached) {
    console.log(`📦 Stock cache hit: ${cached.itemCount} items, age: ${Math.round((Date.now() - cached.updatedAt) / 1000)}s`);
  }

  return cached;
}

/**
 * Get stock for a specific item from cache
 * Returns null if not in cache
 */
export async function getCachedStock(itemId: string): Promise<number | null> {
  const cached = await getStockCache();
  if (!cached) return null;

  const stock = cached.stock[itemId];
  return stock !== undefined ? stock : null;
}

/**
 * Get stock map for multiple items from cache
 * Returns map of itemId -> stock, excludes items not in cache
 */
export async function getCachedStockBulk(itemIds: string[]): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  const cached = await getStockCache();

  if (!cached) return stockMap;

  for (const itemId of itemIds) {
    const stock = cached.stock[itemId];
    if (stock !== undefined) {
      stockMap.set(itemId, stock);
    }
  }

  return stockMap;
}

/**
 * Sync warehouse-specific stock for all products to Redis cache
 * This is the main sync function - call it periodically or via cron
 *
 * Options:
 * - batchSize: Number of items to fetch per batch (default: 10)
 * - delayMs: Delay between batches in milliseconds (default: 1000)
 * - maxItems: Maximum items to process per call (default: unlimited)
 * - offset: Starting offset for chunked sync (default: 0)
 * - skipLock: Skip lock check for chunked sync (default: false)
 */
export async function syncWholesaleStock(options: {
  batchSize?: number;
  delayMs?: number;
  maxItems?: number;
  offset?: number;
  skipLock?: boolean;
} = {}): Promise<{
  success: boolean;
  itemsProcessed: number;
  errors: number;
  durationMs: number;
  totalItems?: number;
  nextOffset?: number;
}> {
  const { batchSize = 10, delayMs = 1000, maxItems, offset = 0, skipLock = false } = options;
  const startTime = Date.now();

  console.log(`🔄 Starting wholesale stock sync (offset=${offset}, maxItems=${maxItems || 'all'})...`);

  // Try to acquire lock to prevent concurrent syncs (skip for chunked sync)
  if (!skipLock) {
    const lockAcquired = await redisSetNx(STOCK_SYNC_LOCK_KEY, Date.now().toString(), STOCK_SYNC_LOCK_TTL);
    if (!lockAcquired) {
      console.log('⏳ Stock sync already in progress, skipping...');
      return { success: false, itemsProcessed: 0, errors: 0, durationMs: 0 };
    }
  }

  try {
    // Step 1: Fetch all product IDs from list API
    console.log('📋 Fetching product list...');
    const allItems: ZohoItemWithLocations[] = [];
    let currentPage = 1;
    const perPage = 200;
    let hasMorePages = true;

    while (hasMorePages) {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsResponse>('/items', {
          api: 'inventory',
          params: {
            page: currentPage,
            per_page: perPage,
            filter_by: 'Status.Active',
            warehouse_id: WHOLESALE_WAREHOUSE_ID,
          },
        })
      );

      if (data.items && data.items.length > 0) {
        allItems.push(...data.items);
      }

      hasMorePages = data.page_context?.has_more_page ?? false;
      currentPage++;

      // Safety limit
      if (currentPage > 20) break;
    }

    console.log(`📦 Found ${allItems.length} total products`);

    // Apply offset and maxItems for chunked sync
    const startIndex = Math.min(offset, allItems.length);
    const endIndex = maxItems ? Math.min(startIndex + maxItems, allItems.length) : allItems.length;
    const itemsToProcess = allItems.slice(startIndex, endIndex);

    console.log(`📊 Processing items ${startIndex + 1} to ${endIndex} of ${allItems.length}`);

    // Step 2: Fetch individual items to get location-specific stock
    const stockMap: StockMap = {};
    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);

      // Fetch batch in parallel
      const batchPromises = batch.map(async (item) => {
        try {
          const data = await zohoFetch<ZohoSingleItemResponse>(`/items/${item.item_id}`, {
            api: 'inventory',
          });
          return {
            itemId: item.item_id,
            stock: getWholesaleAvailableStock(data.item),
            error: false,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          // On rate limit, wait and retry once
          if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('blocked')) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
              const retryData = await zohoFetch<ZohoSingleItemResponse>(`/items/${item.item_id}`, {
                api: 'inventory',
              });
              return {
                itemId: item.item_id,
                stock: getWholesaleAvailableStock(retryData.item),
                error: false,
              };
            } catch {
              return { itemId: item.item_id, stock: 0, error: true };
            }
          }
          return { itemId: item.item_id, stock: 0, error: true };
        }
      });

      const results = await Promise.all(batchPromises);

      for (const result of results) {
        stockMap[result.itemId] = result.stock;
        if (result.error) errorCount++;
      }

      processedCount += batch.length;

      // Log progress
      if (processedCount % 100 === 0 || processedCount === itemsToProcess.length) {
        const progress = Math.round((processedCount / itemsToProcess.length) * 100);
        console.log(`📊 Stock sync progress: ${processedCount}/${itemsToProcess.length} (${progress}%)`);
      }

      // Delay between batches to avoid rate limits
      if (i + batchSize < itemsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Step 3: Save to Redis (merge with existing cache for chunked sync)
    const existingCache = await getStockCache();
    const mergedStock: StockMap = existingCache?.stock || {};

    // Merge new stock data
    for (const [itemId, stock] of Object.entries(stockMap)) {
      mergedStock[itemId] = stock;
    }

    const cacheData: StockCacheData = {
      stock: mergedStock,
      updatedAt: Date.now(),
      itemCount: Object.keys(mergedStock).length,
    };

    const saved = await redisSet(STOCK_CACHE_KEY, cacheData, STOCK_CACHE_TTL);

    const durationMs = Date.now() - startTime;

    // Calculate next offset for chunked sync
    const nextOffset = endIndex < allItems.length ? endIndex : undefined;

    if (saved) {
      console.log(`✅ Stock sync complete: ${processedCount} items (total cached: ${cacheData.itemCount}) in ${Math.round(durationMs / 1000)}s`);
      if (nextOffset) {
        console.log(`📝 More items to sync. Next offset: ${nextOffset}`);
      }
    } else {
      console.error('❌ Failed to save stock cache to Redis');
    }

    return {
      success: saved,
      itemsProcessed: processedCount,
      errors: errorCount,
      durationMs,
      totalItems: allItems.length,
      nextOffset,
    };

  } finally {
    // Release lock (only if we acquired it)
    if (!skipLock) {
      await redisDel(STOCK_SYNC_LOCK_KEY);
    }
  }
}

/**
 * Quick sync: Only sync items that have been updated recently
 * Faster than full sync, good for frequent updates
 *
 * IMPORTANT: Uses Inventory API (not Books) because it returns
 * warehouse-specific stock via the `locations` array.
 *
 * Includes retry logic for rate limits and better error tracking.
 */
export async function quickSyncStock(itemIds: string[]): Promise<{
  success: boolean;
  itemsUpdated: number;
  errors: string[];
}> {
  if (itemIds.length === 0) {
    return { success: true, itemsUpdated: 0, errors: [] };
  }

  console.log(`🔄 [quickSyncStock] Starting sync for ${itemIds.length} items: [${itemIds.join(', ')}]`);

  // Get existing cache
  const cached = await getStockCache();
  const stockMap: StockMap = cached?.stock || {};
  const errors: string[] = [];

  // Fetch individual items with retry logic
  let updatedCount = 0;

  for (const itemId of itemIds) {
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoSingleItemResponse>(`/items/${itemId}`, {
            api: 'inventory', // Required for warehouse-specific stock
          })
        );

        const stock = getWholesaleAvailableStock(data.item);
        stockMap[itemId] = stock;
        updatedCount++;
        console.log(`📦 [quickSyncStock] ${itemId}: stock = ${stock}`);
        break; // Success, exit retry loop

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message;

        // Check if rate limited
        if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('blocked')) {
          console.warn(`⚠️ [quickSyncStock] Rate limited on ${itemId}, waiting 3s (${retries - 1} retries left)...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          retries--;
        } else {
          // Non-rate-limit error, don't retry
          console.error(`❌ [quickSyncStock] Failed to fetch ${itemId}: ${errorMsg}`);
          errors.push(`${itemId}: ${errorMsg}`);
          break;
        }
      }
    }

    if (retries === 0 && lastError) {
      errors.push(`${itemId}: Rate limited after 3 retries`);
      console.error(`❌ [quickSyncStock] Gave up on ${itemId} after rate limit retries`);
    }

    // Small delay between requests to avoid rate limits
    if (itemIds.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Save updated cache with retry
  const cacheData: StockCacheData = {
    stock: stockMap,
    updatedAt: Date.now(),
    itemCount: Object.keys(stockMap).length,
  };

  let saved = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    saved = await redisSet(STOCK_CACHE_KEY, cacheData, STOCK_CACHE_TTL);
    if (saved) {
      console.log(`✅ [quickSyncStock] Redis save successful on attempt ${attempt}`);
      break;
    }
    console.warn(`⚠️ [quickSyncStock] Redis save attempt ${attempt} failed, retrying...`);
    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
  }

  if (!saved) {
    errors.push('Redis: Failed to save after 3 attempts');
    console.error(`❌ [quickSyncStock] CRITICAL: Failed to save to Redis after 3 attempts!`);
  }

  const success = saved && errors.length === 0;
  console.log(`${success ? '✅' : '⚠️'} [quickSyncStock] Complete: ${updatedCount}/${itemIds.length} items updated, ${errors.length} errors`);

  return {
    success,
    itemsUpdated: updatedCount,
    errors,
  };
}

/**
 * Check if stock cache is stale (older than threshold)
 */
export async function isStockCacheStale(maxAgeMs: number = 30 * 60 * 1000): Promise<boolean> {
  const cached = await getStockCache();
  if (!cached) return true;

  const age = Date.now() - cached.updatedAt;
  return age > maxAgeMs;
}

/**
 * Get stock cache status for monitoring
 */
export async function getStockCacheStatus(): Promise<{
  exists: boolean;
  itemCount: number;
  ageSeconds: number;
  isStale: boolean;
}> {
  const cached = await getStockCache();

  if (!cached) {
    return {
      exists: false,
      itemCount: 0,
      ageSeconds: 0,
      isStale: true,
    };
  }

  const ageSeconds = Math.round((Date.now() - cached.updatedAt) / 1000);

  return {
    exists: true,
    itemCount: cached.itemCount,
    ageSeconds,
    isStale: ageSeconds > STOCK_CACHE_TTL,
  };
}

// ============================================
// UNIFIED STOCK FUNCTIONS (SINGLE SOURCE OF TRUTH)
// ============================================
// These functions ensure BOTH list and detail pages use
// the SAME stock source, preventing discrepancies.
// ============================================

/**
 * SINGLE SOURCE OF TRUTH for stock retrieval
 * Both list and detail pages MUST use this function
 *
 * Priority:
 * 1. Redis cache (warehouse-specific, most accurate)
 * 2. Fetch from Inventory API + cache result (on-demand caching)
 *
 * NEVER falls back to Books API item-level stock to avoid discrepancy
 *
 * @param itemId - The item ID to get stock for
 * @param options.fetchOnMiss - If true, fetch from API when cache misses. If false, return null on miss
 * @param options.context - Context for logging (e.g., 'product-detail', 'shop-list')
 */
export async function getUnifiedStock(
  itemId: string,
  options: {
    fetchOnMiss?: boolean;
    context?: string;
  } = {}
): Promise<{ stock: number; source: 'cache' | 'api' | 'unavailable' }> {
  const { fetchOnMiss = true, context = 'unknown' } = options;

  // Step 1: Check Redis cache
  const cached = await getStockCache();
  if (cached && cached.stock[itemId] !== undefined) {
    const stock = cached.stock[itemId];
    console.log(`[getUnifiedStock] ${itemId}: ${stock} from cache (${context})`);
    return { stock, source: 'cache' };
  }

  // Step 2: Cache miss - decide whether to fetch
  if (!fetchOnMiss) {
    console.log(`[getUnifiedStock] ${itemId}: cache miss, fetchOnMiss=false (${context})`);
    return { stock: 0, source: 'unavailable' };
  }

  // Step 3: Fetch from Inventory API (warehouse-specific)
  console.log(`[getUnifiedStock] ${itemId}: cache miss, fetching from Inventory API (${context})`);

  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoSingleItemResponse>(`/items/${itemId}`, {
        api: 'inventory',
      })
    );

    if (!data.item) {
      console.warn(`[getUnifiedStock] ${itemId}: item not found in Inventory API (${context})`);
      return { stock: 0, source: 'unavailable' };
    }

    // Extract warehouse-specific stock
    const stock = getWholesaleAvailableStock(data.item);

    // Step 4: ON-DEMAND CACHING - save to Redis for future consistency
    await cacheStockOnDemand(itemId, stock);

    console.log(`[getUnifiedStock] ${itemId}: ${stock} from API, cached (${context})`);
    return { stock, source: 'api' };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[getUnifiedStock] ${itemId}: API error (${context}) - ${errorMsg}`);
    return { stock: 0, source: 'unavailable' };
  }
}

/**
 * Cache a single item's stock on-demand
 * Used when detail page fetches fresh stock - ensures list page sees same value
 */
async function cacheStockOnDemand(itemId: string, stock: number): Promise<void> {
  try {
    const cached = await getStockCache();
    const stockMap: StockMap = cached?.stock || {};

    stockMap[itemId] = stock;

    const cacheData: StockCacheData = {
      stock: stockMap,
      updatedAt: cached?.updatedAt || Date.now(), // Preserve original timestamp if cache exists
      itemCount: Object.keys(stockMap).length,
    };

    await redisSet(STOCK_CACHE_KEY, cacheData, STOCK_CACHE_TTL);
    console.log(`[cacheStockOnDemand] ${itemId}: stock ${stock} saved to Redis`);
  } catch (error) {
    // Non-critical - log but don't throw
    console.warn(`[cacheStockOnDemand] ${itemId}: failed to cache -`, error);
  }
}

/**
 * Bulk version for list page - returns Map of itemId -> stock
 * Items not in cache will have stock = 0 (no API fetch to avoid rate limits)
 *
 * IMPORTANT: This function ONLY uses Redis cache. It does NOT fall back to
 * Books API item-level stock, which would cause discrepancies with the detail page.
 *
 * @param itemIds - Array of item IDs to get stock for
 * @param options.context - Context for logging
 */
export async function getUnifiedStockBulk(
  itemIds: string[],
  options: {
    context?: string;
  } = {}
): Promise<Map<string, number>> {
  const { context = 'bulk' } = options;
  const stockMap = new Map<string, number>();

  const cached = await getStockCache();

  if (!cached || cached.itemCount === 0) {
    console.warn(`[getUnifiedStockBulk] Cache empty - all items will show 0 stock (${context})`);
    // Return map with 0 for all items - caller should handle this
    for (const itemId of itemIds) {
      stockMap.set(itemId, 0);
    }
    return stockMap;
  }

  let hitCount = 0;
  let missCount = 0;

  for (const itemId of itemIds) {
    const stock = cached.stock[itemId];
    if (stock !== undefined) {
      stockMap.set(itemId, stock);
      hitCount++;
    } else {
      // Cache miss - return 0, do NOT use Books fallback
      stockMap.set(itemId, 0);
      missCount++;
    }
  }

  // Log cache hit rate for monitoring
  const hitRate = ((hitCount / itemIds.length) * 100).toFixed(1);
  console.log(`[getUnifiedStockBulk] ${hitCount}/${itemIds.length} cache hits (${hitRate}%), ${missCount} misses (${context})`);

  // Warn if hit rate is low - suggests cache needs syncing
  if (missCount > hitCount && itemIds.length > 10) {
    console.warn(`[getUnifiedStockBulk] LOW CACHE HIT RATE - consider running stock sync (${context})`);
  }

  return stockMap;
}

// ============================================
// FAST SYNC USING ZOHO BOOKS API
// ============================================
// Books API has ~100 requests/minute vs Inventory's ~3,750/day
// This function uses Books API for faster sync without rate limits
// ============================================

interface ZohoBooksItemStock {
  item_id: string;
  name: string;
  sku: string;
  available_stock?: number;
  stock_on_hand?: number;
  actual_available_stock?: number;
}

interface ZohoBooksItemsResponse {
  items: ZohoBooksItemStock[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

/**
 * FAST SYNC using Zoho Books API (higher rate limits)
 *
 * Uses Books API which has ~100 requests/minute vs Inventory's ~3,750/day
 * Stock from Books is item-level (total across all warehouses) but is
 * sufficient for most use cases and much faster to sync.
 *
 * Options:
 * - maxItems: Maximum items to process per call (default: unlimited)
 * - offset: Starting offset for chunked sync (default: 0)
 */
export async function syncStockFromBooks(options: {
  maxItems?: number;
  offset?: number;
} = {}): Promise<{
  success: boolean;
  itemsProcessed: number;
  itemsWithStock: number;
  durationMs: number;
  totalItems?: number;
  nextOffset?: number;
}> {
  const { maxItems = 500, offset = 0 } = options;
  const startTime = Date.now();

  console.log(`🚀 [syncStockFromBooks] Starting FAST sync using Books API (offset=${offset}, maxItems=${maxItems})...`);

  try {
    // Fetch products from Books API (much higher rate limits)
    const allItems: ZohoBooksItemStock[] = [];
    let currentPage = Math.floor(offset / 200) + 1;
    const perPage = 200;
    let hasMorePages = true;
    let totalFetched = 0;

    while (hasMorePages && totalFetched < maxItems) {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoBooksItemsResponse>('/items', {
          api: 'books', // Using Books API - higher rate limits!
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
        allItems.push(...data.items);
        totalFetched += data.items.length;
        console.log(`📦 [syncStockFromBooks] Page ${currentPage}: ${data.items.length} items (total: ${totalFetched})`);
      }

      hasMorePages = data.page_context?.has_more_page ?? false;
      currentPage++;

      // Safety limit
      if (currentPage > 20) break;
    }

    console.log(`📊 [syncStockFromBooks] Fetched ${allItems.length} products from Books API`);

    // Get existing cache to merge
    const existingCache = await getStockCache();
    const stockMap: StockMap = existingCache?.stock || {};

    // Process items and update stock map
    let itemsWithStock = 0;
    for (const item of allItems) {
      const stock = item.available_stock ?? item.actual_available_stock ?? item.stock_on_hand ?? 0;
      stockMap[item.item_id] = stock;
      if (stock > 0) itemsWithStock++;
    }

    // Save to Redis
    const cacheData: StockCacheData = {
      stock: stockMap,
      updatedAt: Date.now(),
      itemCount: Object.keys(stockMap).length,
    };

    const saved = await redisSet(STOCK_CACHE_KEY, cacheData, STOCK_CACHE_TTL);
    const durationMs = Date.now() - startTime;

    // Calculate next offset
    const nextOffset = hasMorePages ? offset + totalFetched : undefined;

    if (saved) {
      console.log(`✅ [syncStockFromBooks] Complete: ${allItems.length} items synced (${itemsWithStock} with stock), total cached: ${cacheData.itemCount}, took ${Math.round(durationMs / 1000)}s`);
    } else {
      console.error('❌ [syncStockFromBooks] Failed to save to Redis');
    }

    return {
      success: saved,
      itemsProcessed: allItems.length,
      itemsWithStock,
      durationMs,
      totalItems: existingCache?.itemCount || allItems.length,
      nextOffset,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ [syncStockFromBooks] Error: ${errorMsg}`);
    return {
      success: false,
      itemsProcessed: 0,
      itemsWithStock: 0,
      durationMs: Date.now() - startTime,
    };
  }
}
