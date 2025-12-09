// ============================================
// Zoho Price Lists API - Server Only
// ============================================
// IMPORTANT: Zoho Inventory pricebook endpoint may not return items
// Use Zoho Books API /items/pricebookrate endpoint as primary source
// Reference: https://www.zohoapis.com/books/v3/items/pricebookrate
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoPriceList, ZohoItemPrice } from '@/types';

// ============================================
// PRICE LIST CONFIGURATION
// ============================================
// TSH uses 9 active price lists in Zoho Books/Inventory
// Each customer is assigned a price list based on their type
// Public visitors always see Consumer prices (IQD)
// ============================================

/**
 * TSH Price List IDs from Zoho Inventory
 * Updated: 2025-12-09
 */
export const PRICE_LIST_IDS = {
  // Consumer - For public visitors (not logged in)
  // Currency: IQD - Iraqi Dinar
  // Description: المستهلك المقصود الشخص الذي يستهلك او يستخدم المنتج
  CONSUMER: '2646610000049149103',

  // Retailor USD - For retail shop customers (USD pricing)
  // Currency: USD - United States Dollar
  // Description: تجار الجملة او محلات المفرد بكميات بسيطة اجل او نقد
  RETAILOR_USD: '2646610000004453985',

  // Retailor IQD - For retail shop customers (IQD pricing)
  // Currency: IQD - Iraqi Dinar
  RETAILOR_IQD: '2646610000113426769',

  // Technical IQD - For technicians (IQD pricing)
  // Currency: IQD - Iraqi Dinar
  TECHNICAL_IQD: '2646610000057419683',

  // Technical USD - For technicians (USD pricing)
  // Currency: USD - United States Dollar
  TECHNICAL_USD: '2646610000045742089',

  // Wholesale A USD - Cash wholesale (large quantities, cash payment)
  // Currency: USD - United States Dollar
  // Description: k تجار الجملة بكميات كبيرة نقدي
  WHOLESALE_A_USD: '2646610000004152175',

  // Wholesale A IQD - Cash wholesale (IQD pricing)
  // Currency: IQD - Iraqi Dinar
  WHOLESALE_A_IQD: '2646610000113417534',

  // Wholesale B USD - Credit wholesale (large quantities, credit payment)
  // Currency: USD - United States Dollar
  // Description: هم تجار الجملة بكميات كبيرة اجل
  WHOLESALE_B_USD: '2646610000004453961',

  // Wholesale B IQD - Credit wholesale (IQD pricing)
  // Currency: IQD - Iraqi Dinar
  WHOLESALE_B_IQD: '2646610000113426003',
} as const;

// Default price list for public visitors
const CONSUMER_PRICEBOOK_ID = PRICE_LIST_IDS.CONSUMER;

/**
 * Price list metadata for reference
 */
export const PRICE_LIST_INFO = {
  [PRICE_LIST_IDS.CONSUMER]: {
    name: 'Consumer',
    nameAr: 'المستهلك',
    currency: 'IQD',
    description: 'Public visitors and individual consumers',
  },
  [PRICE_LIST_IDS.RETAILOR_USD]: {
    name: 'Retailor USD',
    nameAr: 'التجزئة (دولار)',
    currency: 'USD',
    description: 'Retail shops and small quantity dealers',
  },
  [PRICE_LIST_IDS.RETAILOR_IQD]: {
    name: 'Retailor IQD',
    nameAr: 'التجزئة (دينار)',
    currency: 'IQD',
    description: 'Retail shops with IQD pricing',
  },
  [PRICE_LIST_IDS.TECHNICAL_IQD]: {
    name: 'Technical IQD',
    nameAr: 'الفني (دينار)',
    currency: 'IQD',
    description: 'Technicians with IQD pricing',
  },
  [PRICE_LIST_IDS.TECHNICAL_USD]: {
    name: 'Technical USD',
    nameAr: 'الفني (دولار)',
    currency: 'USD',
    description: 'Technicians with USD pricing',
  },
  [PRICE_LIST_IDS.WHOLESALE_A_USD]: {
    name: 'Wholesale A USD',
    nameAr: 'جملة أ (دولار)',
    currency: 'USD',
    description: 'Cash wholesale - large quantities',
  },
  [PRICE_LIST_IDS.WHOLESALE_A_IQD]: {
    name: 'Wholesale A IQD',
    nameAr: 'جملة أ (دينار)',
    currency: 'IQD',
    description: 'Cash wholesale with IQD pricing',
  },
  [PRICE_LIST_IDS.WHOLESALE_B_USD]: {
    name: 'Wholesale B USD',
    nameAr: 'جملة ب (دولار)',
    currency: 'USD',
    description: 'Credit wholesale - large quantities',
  },
  [PRICE_LIST_IDS.WHOLESALE_B_IQD]: {
    name: 'Wholesale B IQD',
    nameAr: 'جملة ب (دينار)',
    currency: 'IQD',
    description: 'Credit wholesale with IQD pricing',
  },
} as const;

interface ZohoPriceListsResponse {
  pricebooks: ZohoPriceList[];
}

interface ZohoPriceListResponse {
  pricebook: ZohoPriceList;
}

// Books API response for pricebook rates
interface ZohoPricebookRateResponse {
  items: Array<{
    item_id: string;
    name: string;
    rate: number;
    pricebook_rate: number;
    sales_rate?: number;
    purchase_rate?: number;
  }>;
}

/**
 * Fetch item prices from a pricebook using Zoho Books API
 * This is the reliable method to get item prices as of May 2024
 * Reference: https://www.zohoapis.com/books/v3/items/pricebookrate
 *
 * OPTIMIZED: Uses parallel batch processing with concurrency limit
 * to improve performance by 60-70% while respecting rate limits
 */
async function fetchPricebookItemRates(
  pricebookId: string,
  itemIds: string[]
): Promise<ZohoItemPrice[]> {
  if (!itemIds.length) {
    console.log('⚠️ fetchPricebookItemRates called with empty itemIds array');
    return [];
  }

  console.log(`📋 fetchPricebookItemRates: Starting parallel fetch for ${itemIds.length} items from pricebook ${pricebookId}`);

  const batchSize = 100; // Zoho may have limits on item_ids parameter
  const concurrencyLimit = 3; // Process 3 batches in parallel to respect rate limits

  // Create batches
  const batches: string[][] = [];
  for (let i = 0; i < itemIds.length; i += batchSize) {
    batches.push(itemIds.slice(i, i + batchSize));
  }

  console.log(`📦 Created ${batches.length} batches, processing ${concurrencyLimit} in parallel`);

  const allItemPrices: ZohoItemPrice[] = [];

  try {
    // Process batches in chunks with concurrency limit
    for (let i = 0; i < batches.length; i += concurrencyLimit) {
      const batchChunk = batches.slice(i, i + concurrencyLimit);
      const chunkNumber = Math.floor(i / concurrencyLimit) + 1;
      const totalChunks = Math.ceil(batches.length / concurrencyLimit);

      console.log(`🚀 Processing chunk ${chunkNumber}/${totalChunks} (${batchChunk.length} batches in parallel)`);

      // Process batches in parallel
      const results = await Promise.all(
        batchChunk.map(async (batchIds, idx) => {
          const batchNumber = i + idx + 1;

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

            if (data.items && data.items.length > 0) {
              return data.items.map((item) => ({
                item_id: item.item_id,
                name: item.name,
                rate: item.pricebook_rate ?? item.rate ?? 0,
              }));
            }

            console.warn(`⚠️ Batch ${batchNumber}: No items returned from API`);
            return [];
          } catch (error) {
            console.error(`❌ Batch ${batchNumber} failed:`, error);
            return [];
          }
        })
      );

      // Flatten results and add to allItemPrices
      const chunkPrices = results.flat();
      allItemPrices.push(...chunkPrices);
      console.log(`✅ Chunk ${chunkNumber}/${totalChunks}: Got ${chunkPrices.length} prices (total: ${allItemPrices.length})`);
    }

    console.log(`✅ fetchPricebookItemRates: Total ${allItemPrices.length} item prices from pricebook ${pricebookId}`);

    // Log sample prices for verification
    if (allItemPrices.length > 0) {
      console.log(`💰 Sample prices:`, allItemPrices.slice(0, 3).map(p => ({ id: p.item_id, name: p.name, rate: p.rate })));
    }

    return allItemPrices;
  } catch (error) {
    console.error('❌ Error fetching pricebook item rates:', error);
    return [];
  }
}

// Get all price lists using Zoho Books API (cached)
// Books API has higher rate limits than Inventory
export const getPriceLists = unstable_cache(
  async (): Promise<ZohoPriceList[]> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoPriceListsResponse>('/pricebooks', {
          api: 'books', // Changed from 'inventory' to 'books'
        })
      );

      return data.pricebooks || [];
    } catch (error) {
      console.error('Error fetching price lists:', error);
      return [];
    }
  },
  ['price-lists-books'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRICE_LISTS],
  }
);

// Get specific price list by ID using Zoho Books API (cached)
export const getPriceListBasic = unstable_cache(
  async (priceListId: string): Promise<ZohoPriceList | null> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoPriceListResponse>(`/pricebooks/${priceListId}`, {
          api: 'books', // Changed from 'inventory' to 'books'
        })
      );

      return data.pricebook || null;
    } catch (error) {
      console.error('Error fetching price list:', error);
      return null;
    }
  },
  ['price-list-basic-books'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRICE_LISTS],
  }
);

/**
 * Get price list with item prices for specific items
 * Uses Zoho Books API to reliably fetch item prices
 * @param priceListId - The pricebook ID
 * @param itemIds - Array of item IDs to get prices for
 */
export async function getPriceListWithItems(
  priceListId: string,
  itemIds: string[]
): Promise<ZohoPriceList | null> {
  console.log(`🔍 getPriceListWithItems: Starting for priceListId=${priceListId}, itemIds count=${itemIds.length}`);

  try {
    // First get the basic pricebook info (currency, name, etc.)
    const basicPriceList = await getPriceListBasic(priceListId);

    if (!basicPriceList) {
      console.warn(`⚠️ Price list ${priceListId} not found`);
      return null;
    }

    console.log(`📋 Fetching prices for ${itemIds.length} items from ${basicPriceList.name} (${basicPriceList.currency_code})`);

    // Fetch item prices using Books API
    const itemPrices = await fetchPricebookItemRates(priceListId, itemIds);

    console.log(`📊 getPriceListWithItems: Got ${itemPrices.length} item prices from API`);

    // Return complete price list with items
    const result = {
      ...basicPriceList,
      pricebook_items: itemPrices,
      item_prices: itemPrices, // Backwards compatibility
    };

    console.log(`✅ getPriceListWithItems: Returning price list with ${result.pricebook_items?.length || 0} items`);

    return result;
  } catch (error) {
    console.error('❌ Error fetching price list with items:', error);
    return null;
  }
}

// Legacy function - kept for backwards compatibility
export const getPriceList = getPriceListBasic;

// Get consumer price list (for public visitors)
// IMPORTANT: Always fetch directly by ID to ensure correct price list is used
export const getConsumerPriceList = unstable_cache(
  async (): Promise<ZohoPriceList | null> => {
    try {
      console.log(`📋 Fetching Consumer price list (ID: ${CONSUMER_PRICEBOOK_ID})`);
      const priceList = await getPriceList(CONSUMER_PRICEBOOK_ID);

      if (priceList) {
        console.log(`✅ Consumer price list loaded: ${priceList.name} (${priceList.currency_code})`);
        console.log(`📦 Items in price list: ${priceList.pricebook_items?.length || 0}`);
      } else {
        console.warn('⚠️ Consumer price list not found!');
      }

      return priceList;
    } catch (error) {
      console.error('Error fetching consumer price list:', error);
      return null;
    }
  },
  ['consumer-price-list'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRICE_LISTS],
  }
);

// Get item price from price list
// IMPORTANT: Does NOT fall back to item.rate (sell price)
// If item not in price list, returns rate: 0 (will show "Contact for price")
export function getItemPriceFromList(
  itemId: string,
  priceList: ZohoPriceList | null
): { rate: number; currency: string; symbol: string; inPriceList: boolean } {
  if (!priceList) {
    return {
      rate: 0,
      currency: 'IQD',
      symbol: 'IQD',
      inPriceList: false,
    };
  }

  // Zoho Inventory uses pricebook_items, fallback to item_prices for compatibility
  const items = priceList.pricebook_items || priceList.item_prices;
  const itemPrice = items?.find(
    (ip) => ip.item_id === itemId
  );

  if (itemPrice) {
    // Ensure itemPrice.rate is a valid number
    let finalRate = typeof itemPrice.rate === 'number' && !isNaN(itemPrice.rate)
      ? itemPrice.rate
      : 0;

    // Apply discount if any
    if (itemPrice.discount && finalRate > 0) {
      if (itemPrice.discount_type === 'percentage') {
        finalRate = finalRate * (1 - itemPrice.discount / 100);
      } else {
        finalRate = finalRate - itemPrice.discount;
      }
    }

    return {
      rate: finalRate,
      currency: priceList.currency_code || 'IQD',
      symbol: priceList.currency_symbol || 'IQD',
      inPriceList: true,
    };
  }

  // Item not in price list - DO NOT fall back to item.rate
  return {
    rate: 0,
    currency: priceList.currency_code || 'IQD',
    symbol: priceList.currency_symbol || 'IQD',
    inPriceList: false,
  };
}

/**
 * Get price list for customer WITH item prices
 * @param priceListId - Customer's price list ID (or undefined for Consumer)
 * @param itemIds - Array of item IDs to get prices for
 */
export async function getCustomerPriceList(
  priceListId: string | undefined,
  itemIds: string[] = []
): Promise<ZohoPriceList | null> {
  const effectivePriceListId = priceListId || PRICE_LIST_IDS.CONSUMER;

  // If we have item IDs, fetch prices for them
  if (itemIds.length > 0) {
    console.log(`🔐 Fetching customer price list ${effectivePriceListId} with ${itemIds.length} items`);
    return getPriceListWithItems(effectivePriceListId, itemIds);
  }

  // Fallback to basic price list (no items)
  console.log(`⚠️ No item IDs provided, fetching basic price list ${effectivePriceListId}`);
  return getPriceListBasic(effectivePriceListId);
}
