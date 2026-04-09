#!/usr/bin/env node
// ============================================
// Local Stock Sync Script
// ============================================
// Runs stock sync locally, bypassing Vercel's 10s timeout
// Usage: node scripts/sync-stock.mjs
// ============================================

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load local env (Zoho credentials)
config({ path: join(projectRoot, '.env.local') });
// Load production env (Upstash credentials) - override
config({ path: join(projectRoot, '.env.production'), override: true });

// Configuration from environment
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORGANIZATION_ID = process.env.ZOHO_ORGANIZATION_ID || '748369814';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Stock cache configuration
const STOCK_CACHE_KEY = 'stock:wholesale_map';
const STOCK_CACHE_TTL = 1800; // 30 minutes
const WHOLESALE_LOCATION_NAME = 'WholeSale WareHouse (Warehouse)';
const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

// Global access token
let accessToken = null;

// ============================================
// Helper Functions
// ============================================

async function getAccessToken() {
  if (accessToken) return accessToken;

  console.log('Refreshing Zoho access token...');

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: ZOHO_REFRESH_TOKEN,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error}`);
  }

  accessToken = data.access_token;
  console.log('Access token obtained successfully');
  return accessToken;
}

async function zohoFetch(endpoint, params = {}, retries = 3) {
  const token = await getAccessToken();
  const url = new URL(`https://www.zohoapis.com/inventory/v1${endpoint}`);
  url.searchParams.set('organization_id', ZOHO_ORGANIZATION_ID);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });

    if (response.ok) {
      return response.json();
    }

    const text = await response.text();

    // Handle rate limiting
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 60000; // 2, 4, 8 minutes
      console.log(`  Rate limited (429). Waiting ${waitTime / 60000} minutes before retry ${attempt}/${retries}...`);
      await delay(waitTime);
      continue;
    }

    throw new Error(`Zoho API error ${response.status}: ${text}`);
  }

  throw new Error(`Failed after ${retries} retries due to rate limiting`);
}

async function redisSet(key, value, ttlSeconds) {
  const response = await fetch(
    `${UPSTASH_REDIS_REST_URL}/setex/${key}/${ttlSeconds}/${encodeURIComponent(JSON.stringify(value))}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    }
  );

  return response.ok;
}

async function redisGet(key) {
  const response = await fetch(
    `${UPSTASH_REDIS_REST_URL}/get/${key}`,
    {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  if (data.result) {
    return JSON.parse(data.result);
  }
  return null;
}

function getWholesaleAvailableStock(item) {
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Main Sync Function
// ============================================

async function syncWholesaleStock() {
  const startTime = Date.now();
  console.log('\n=== Starting Wholesale Stock Sync ===\n');

  // Check config
  console.log('Checking configuration...');
  console.log(`  ZOHO_CLIENT_ID: ${ZOHO_CLIENT_ID ? 'SET' : 'MISSING'}`);
  console.log(`  ZOHO_CLIENT_SECRET: ${ZOHO_CLIENT_SECRET ? 'SET' : 'MISSING'}`);
  console.log(`  ZOHO_REFRESH_TOKEN: ${ZOHO_REFRESH_TOKEN ? 'SET' : 'MISSING'}`);
  console.log(`  UPSTASH_REDIS_REST_URL: ${UPSTASH_REDIS_REST_URL ? 'SET' : 'MISSING'}`);
  console.log(`  UPSTASH_REDIS_REST_TOKEN: ${UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'MISSING'}`);

  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error('Missing Zoho credentials. Make sure .env.local is properly configured.');
  }

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing Upstash Redis credentials.');
  }

  console.log('\n');

  // Step 1: Fetch all product IDs
  console.log('Step 1: Fetching product list...');
  const allItems = [];
  let currentPage = 1;
  const perPage = 200;
  let hasMorePages = true;

  while (hasMorePages) {
    const data = await zohoFetch('/items', {
      page: currentPage,
      per_page: perPage,
      filter_by: 'Status.Active',
      warehouse_id: WHOLESALE_WAREHOUSE_ID,
    });

    if (data.items && data.items.length > 0) {
      allItems.push(...data.items);
      console.log(`  Fetched page ${currentPage}: ${data.items.length} items (total: ${allItems.length})`);
    }

    hasMorePages = data.page_context?.has_more_page ?? false;
    currentPage++;

    // Small delay between pages
    await delay(500);

    // Safety limit
    if (currentPage > 20) {
      console.log('  Safety limit reached (20 pages)');
      break;
    }
  }

  console.log(`\nFound ${allItems.length} total products\n`);

  // Step 2: Fetch individual items to get location-specific stock
  console.log('Step 2: Fetching per-item stock from locations...');
  const stockMap = {};
  let processedCount = 0;
  let errorCount = 0;
  const batchSize = 5;
  const batchDelay = 1000;

  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);

    // Fetch batch in parallel
    const batchPromises = batch.map(async (item) => {
      try {
        const data = await zohoFetch(`/items/${item.item_id}`);
        return {
          itemId: item.item_id,
          name: item.name,
          stock: getWholesaleAvailableStock(data.item),
          error: false,
        };
      } catch (error) {
        const errorMsg = error.message || String(error);
        // Rate limit handling
        if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('blocked')) {
          console.log(`  Rate limited on ${item.name}, waiting 5s and retrying...`);
          await delay(5000);
          try {
            const retryData = await zohoFetch(`/items/${item.item_id}`);
            return {
              itemId: item.item_id,
              name: item.name,
              stock: getWholesaleAvailableStock(retryData.item),
              error: false,
            };
          } catch {
            return { itemId: item.item_id, name: item.name, stock: 0, error: true };
          }
        }
        console.error(`  Error fetching ${item.name}: ${errorMsg}`);
        return { itemId: item.item_id, name: item.name, stock: 0, error: true };
      }
    });

    const results = await Promise.all(batchPromises);

    for (const result of results) {
      stockMap[result.itemId] = result.stock;
      if (result.error) errorCount++;
    }

    processedCount += batch.length;

    // Log progress every 50 items
    if (processedCount % 50 === 0 || processedCount === allItems.length) {
      const progress = Math.round((processedCount / allItems.length) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  Progress: ${processedCount}/${allItems.length} (${progress}%) - ${elapsed}s elapsed`);
    }

    // Delay between batches
    if (i + batchSize < allItems.length) {
      await delay(batchDelay);
    }
  }

  // Step 3: Save to Redis
  console.log('\nStep 3: Saving to Redis...');
  const cacheData = {
    stock: stockMap,
    updatedAt: Date.now(),
    itemCount: Object.keys(stockMap).length,
  };

  const saved = await redisSet(STOCK_CACHE_KEY, cacheData, STOCK_CACHE_TTL);

  const durationMs = Date.now() - startTime;
  const durationSec = Math.round(durationMs / 1000);

  console.log('\n=== Sync Complete ===');
  console.log(`  Items processed: ${processedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Duration: ${durationSec}s`);
  console.log(`  Saved to Redis: ${saved ? 'YES' : 'FAILED'}`);

  // Verify cache
  const cached = await redisGet(STOCK_CACHE_KEY);
  if (cached) {
    console.log(`  Cache verified: ${cached.itemCount} items`);
  }

  return {
    success: saved,
    itemsProcessed: processedCount,
    errors: errorCount,
    durationMs,
  };
}

// ============================================
// Run
// ============================================

syncWholesaleStock()
  .then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  });
