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
 * - maxItems: Maximum items to process (default: unlimited)
 */
export async function syncWholesaleStock(options: {
  batchSize?: number;
  delayMs?: number;
  maxItems?: number;
} = {}): Promise<{
  success: boolean;
  itemsProcessed: number;
  errors: number;
  durationMs: number;
}> {
  const { batchSize = 10, delayMs = 1000, maxItems } = options;
  const startTime = Date.now();

  console.log('🔄 Starting wholesale stock sync...');

  // Try to acquire lock to prevent concurrent syncs
  const lockAcquired = await redisSetNx(STOCK_SYNC_LOCK_KEY, Date.now().toString(), STOCK_SYNC_LOCK_TTL);
  if (!lockAcquired) {
    console.log('⏳ Stock sync already in progress, skipping...');
    return { success: false, itemsProcessed: 0, errors: 0, durationMs: 0 };
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

    console.log(`📦 Found ${allItems.length} products to sync`);

    // Apply maxItems limit if specified
    const itemsToProcess = maxItems ? allItems.slice(0, maxItems) : allItems;

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

    // Step 3: Save to Redis
    const cacheData: StockCacheData = {
      stock: stockMap,
      updatedAt: Date.now(),
      itemCount: Object.keys(stockMap).length,
    };

    const saved = await redisSet(STOCK_CACHE_KEY, cacheData, STOCK_CACHE_TTL);

    const durationMs = Date.now() - startTime;

    if (saved) {
      console.log(`✅ Stock sync complete: ${processedCount} items in ${Math.round(durationMs / 1000)}s`);
    } else {
      console.error('❌ Failed to save stock cache to Redis');
    }

    return {
      success: saved,
      itemsProcessed: processedCount,
      errors: errorCount,
      durationMs,
    };

  } finally {
    // Release lock
    await redisDel(STOCK_SYNC_LOCK_KEY);
  }
}

/**
 * Quick sync: Only sync items that have been updated recently
 * Faster than full sync, good for frequent updates
 */
export async function quickSyncStock(itemIds: string[]): Promise<{
  success: boolean;
  itemsUpdated: number;
}> {
  if (itemIds.length === 0) {
    return { success: true, itemsUpdated: 0 };
  }

  console.log(`🔄 Quick sync for ${itemIds.length} items...`);

  // Get existing cache
  const cached = await getStockCache();
  const stockMap: StockMap = cached?.stock || {};

  // Fetch individual items
  let updatedCount = 0;

  for (const itemId of itemIds) {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoSingleItemResponse>(`/items/${itemId}`, {
          api: 'inventory',
        })
      );
      stockMap[itemId] = getWholesaleAvailableStock(data.item);
      updatedCount++;

      // Small delay between requests
      if (itemIds.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Failed to sync stock for ${itemId}:`, error);
    }
  }

  // Save updated cache
  const cacheData: StockCacheData = {
    stock: stockMap,
    updatedAt: Date.now(),
    itemCount: Object.keys(stockMap).length,
  };

  const saved = await redisSet(STOCK_CACHE_KEY, cacheData, STOCK_CACHE_TTL);

  console.log(`✅ Quick sync complete: ${updatedCount}/${itemIds.length} items updated`);

  return {
    success: saved,
    itemsUpdated: updatedCount,
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
