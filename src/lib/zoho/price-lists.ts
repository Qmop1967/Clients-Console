// ============================================
// Zoho Price Lists API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoPriceList, ZohoItemPrice } from '@/types';

interface ZohoPriceListsResponse {
  pricebooks: ZohoPriceList[];
}

interface ZohoPriceListResponse {
  pricebook: ZohoPriceList;
}

// Get all price lists (cached)
export const getPriceLists = unstable_cache(
  async (): Promise<ZohoPriceList[]> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoPriceListsResponse>('/pricebooks', {
          api: 'inventory',
        })
      );

      return data.pricebooks || [];
    } catch (error) {
      console.error('Error fetching price lists:', error);
      return [];
    }
  },
  ['price-lists'],
  {
    revalidate: 3600, // 1 hour
    tags: [CACHE_TAGS.PRICE_LISTS],
  }
);

// Get specific price list by ID (cached)
export const getPriceList = unstable_cache(
  async (priceListId: string): Promise<ZohoPriceList | null> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoPriceListResponse>(`/pricebooks/${priceListId}`, {
          api: 'inventory',
        })
      );

      return data.pricebook || null;
    } catch (error) {
      console.error('Error fetching price list:', error);
      return null;
    }
  },
  ['price-list'],
  {
    revalidate: 3600,
    tags: [CACHE_TAGS.PRICE_LISTS],
  }
);

// Get consumer/default price list
export const getConsumerPriceList = unstable_cache(
  async (): Promise<ZohoPriceList | null> => {
    try {
      const priceLists = await getPriceLists();
      // Look for default/consumer price list
      const consumerList = priceLists.find(
        (pl) =>
          pl.name.toLowerCase().includes('consumer') ||
          pl.name.toLowerCase().includes('default') ||
          pl.name.toLowerCase().includes('retail')
      );

      if (consumerList) {
        return getPriceList(consumerList.pricebook_id);
      }

      // Return first active price list as fallback
      const activeList = priceLists.find((pl) => pl.is_active);
      return activeList ? getPriceList(activeList.pricebook_id) : null;
    } catch (error) {
      console.error('Error fetching consumer price list:', error);
      return null;
    }
  },
  ['consumer-price-list'],
  {
    revalidate: 3600,
    tags: [CACHE_TAGS.PRICE_LISTS],
  }
);

// Get item price from price list
export function getItemPriceFromList(
  itemId: string,
  priceList: ZohoPriceList | null,
  defaultRate: number
): { rate: number; currency: string; symbol: string } {
  // Ensure defaultRate is a valid number
  const safeDefaultRate = typeof defaultRate === 'number' && !isNaN(defaultRate) ? defaultRate : 0;

  if (!priceList) {
    return {
      rate: safeDefaultRate,
      currency: 'IQD',
      symbol: 'IQD',
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
      : safeDefaultRate;

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
    };
  }

  // Fallback to safe default rate
  return {
    rate: safeDefaultRate,
    currency: priceList.currency_code || 'IQD',
    symbol: priceList.currency_symbol || 'IQD',
  };
}

// Get price list for customer
export async function getCustomerPriceList(
  priceListId: string | undefined
): Promise<ZohoPriceList | null> {
  if (priceListId) {
    return getPriceList(priceListId);
  }
  // Default to consumer price list
  return getConsumerPriceList();
}
