// ============================================
// Odoo Pricelists API - Server Only
// ============================================
// Replaces Odoo pricebooks API with Odoo product.pricelist
// Uses product.pricelist.item for individual pricing rules
// ============================================

import { odooSearchRead, odooRead } from './client';
import type { OdooPricelist, OdooPricelistItem } from './types';

// ============================================
// Pricelist API
// ============================================

/**
 * Get all active pricelists
 */
export async function getPricelists(): Promise<OdooPricelist[]> {
  try {
    return await odooSearchRead<OdooPricelist>(
      'product.pricelist',
      [['active', '=', true]],
      ['id', 'name', 'currency_id', 'active', 'item_ids'],
      { order: 'name ASC' }
    );
  } catch (error) {
    console.error('[Odoo Pricelists] Error fetching pricelists:', error);
    return [];
  }
}

/**
 * Get a single pricelist by ID
 */
export async function getPricelistById(id: number | string): Promise<OdooPricelist | null> {
  try {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) return null;

    const lists = await odooRead<OdooPricelist>(
      'product.pricelist', [numId],
      ['id', 'name', 'currency_id', 'active', 'item_ids']
    );
    return lists.length > 0 ? lists[0] : null;
  } catch (error) {
    console.error(`[Odoo Pricelists] Error fetching pricelist ${id}:`, error);
    return null;
  }
}

/**
 * Get pricelist items (pricing rules) for a pricelist
 */
export async function getPricelistItems(pricelistId: number | string): Promise<OdooPricelistItem[]> {
  try {
    const numId = typeof pricelistId === 'string' ? parseInt(pricelistId, 10) : pricelistId;

    return await odooSearchRead<OdooPricelistItem>(
      'product.pricelist.item',
      [['pricelist_id', '=', numId]],
      [
        'id', 'pricelist_id', 'product_tmpl_id', 'product_id', 'categ_id',
        'applied_on', 'compute_price', 'fixed_price', 'percent_price',
        'min_quantity', 'date_start', 'date_end',
      ],
      { order: 'applied_on ASC, min_quantity DESC' }
    );
  } catch (error) {
    console.error(`[Odoo Pricelists] Error fetching pricelist items for ${pricelistId}:`, error);
    return [];
  }
}

/**
 * Get the price of a specific product in a pricelist
 * Walks through pricelist items to find the best match
 * Priority: product variant > product template > category > global
 */
export async function getProductPrice(
  productId: number,
  pricelistId: number,
  quantity: number = 1
): Promise<{ price: number; found: boolean }> {
  try {
    const items = await getPricelistItems(pricelistId);

    // Find matching rule (most specific first, already sorted by applied_on ASC)
    for (const item of items) {
      // Check date validity
      if (item.date_start && new Date(item.date_start) > new Date()) continue;
      if (item.date_end && new Date(item.date_end) < new Date()) continue;

      // Check minimum quantity
      if (item.min_quantity > quantity) continue;

      let matches = false;

      switch (item.applied_on) {
        case '0_product_variant':
          // Exact product variant match
          matches = Array.isArray(item.product_id) && item.product_id[0] === productId;
          break;
        case '1_product':
          // Product template match (would need template ID — skip for now, handled by variant)
          matches = Array.isArray(item.product_tmpl_id) && item.product_tmpl_id[0] > 0;
          break;
        case '3_global':
          // Global rule — matches everything
          matches = true;
          break;
        // '2_product_category' would need product's category — simplify for now
      }

      if (matches) {
        if (item.compute_price === 'fixed') {
          return { price: item.fixed_price, found: true };
        }
        // percentage and formula are less common for TSH — return list_price as fallback
      }
    }

    return { price: 0, found: false };
  } catch (error) {
    console.error(`[Odoo Pricelists] Error getting product price:`, error);
    return { price: 0, found: false };
  }
}

/**
 * Get prices for multiple products in a pricelist (batch)
 * Returns Map of productId → price
 */
export async function getProductPrices(
  productIds: number[],
  pricelistId: number,
  templateIdMap?: Map<number, number>
): Promise<Map<number, number>> {
  const priceMap = new Map<number, number>();

  try {
    const items = await getPricelistItems(pricelistId);
    const now = new Date();

    // Index items by type for fast lookup
    const variantRules = new Map<number, OdooPricelistItem>();
    const templateRules = new Map<number, OdooPricelistItem>();
    let globalRule: OdooPricelistItem | null = null;

    for (const item of items) {
      if (item.date_start && new Date(item.date_start) > now) continue;
      if (item.date_end && new Date(item.date_end) < now) continue;

      if (item.applied_on === '0_product_variant' && Array.isArray(item.product_id)) {
        variantRules.set(item.product_id[0], item);
      } else if (item.applied_on === '1_product' && Array.isArray(item.product_tmpl_id)) {
        templateRules.set(item.product_tmpl_id[0], item);
      } else if (item.applied_on === '3_global' && !globalRule) {
        globalRule = item;
      }
    }

    for (const pid of productIds) {
      // Priority: variant rule > template rule > global rule
      let rule: OdooPricelistItem | null | undefined = variantRules.get(pid);
      if (!rule && templateIdMap) {
        const tmplId = templateIdMap.get(pid);
        if (tmplId) {
          rule = templateRules.get(tmplId);
        }
      }
      if (!rule) {
        rule = globalRule;
      }
      if (rule && rule.compute_price === 'fixed') {
        priceMap.set(pid, rule.fixed_price);
      }
    }
  } catch (error) {
    console.error('[Odoo Pricelists] Error getting product prices:', error);
  }

  return priceMap;
}

// ============================================
// Compatibility layer for price-lists API
// ============================================

import type { PriceList, ItemPrice } from '@/types';

/**
 * Get customer price list with item prices (compatible)
 * Returns a PriceList with pricebook_items populated
 */
export async function getCustomerPriceList(
  priceListId: string | undefined,
  itemIds: string[] = []
): Promise<PriceList | null> {
  if (!priceListId) return null;

  try {
    const numId = parseInt(priceListId, 10);
    if (isNaN(numId)) return null;

    const pricelist = await getPricelistById(numId);
    if (!pricelist) return null;

    const currencyCode = Array.isArray(pricelist.currency_id)
      ? pricelist.currency_id[1] : 'IQD';

    // If specific items requested, get their prices
    let pricebookItems: ItemPrice[] = [];
    if (itemIds.length > 0) {
      const productIds = itemIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      // Fetch template IDs for these products (needed for 1_product pricelist rules)
      let templateIdMap: Map<number, number> | undefined;
      try {
        const { odooRead } = await import('./client');
        const products = await odooRead<{id: number; product_tmpl_id: [number, string] | false}>('product.product', productIds, ['id', 'product_tmpl_id']);
        templateIdMap = new Map<number, number>();
        for (const p of products) {
          if (Array.isArray(p.product_tmpl_id)) {
            templateIdMap.set(p.id, p.product_tmpl_id[0]);
          }
        }
      } catch (e) {
        console.error('[Odoo Pricelists] Failed to fetch template IDs:', e);
      }
      const priceMap = await getProductPrices(productIds, numId, templateIdMap);

      pricebookItems = productIds
        .filter(pid => priceMap.has(pid))
        .map(pid => ({
          item_id: String(pid),
          name: '',
          rate: priceMap.get(pid)!,
        }));
    }

    return {
      pricebook_id: String(pricelist.id),
      name: pricelist.name,
      currency_code: currencyCode,
      currency_symbol: currencyCode === 'USD' ? '$' : 'IQD',
      is_active: pricelist.active,
      pricebook_items: pricebookItems,
      item_prices: pricebookItems,
    };
  } catch (error) {
    console.error('[Odoo Pricelists] Error getting customer price list:', error);
    return null;
  }
}

/**
 * Get item price from a price list (compatible)
 */
export function getItemPriceFromList(
  itemId: string,
  priceList: PriceList | null
): { rate: number; currency: string; symbol: string; inPriceList: boolean } {
  if (!priceList) {
    return { rate: 0, currency: 'IQD', symbol: 'IQD', inPriceList: false };
  }

  const items = priceList.pricebook_items || priceList.item_prices;
  const itemPrice = items?.find(ip => ip.item_id === itemId);

  if (itemPrice) {
    return {
      rate: itemPrice.rate,
      currency: priceList.currency_code || 'IQD',
      symbol: priceList.currency_symbol || 'IQD',
      inPriceList: true,
    };
  }

  return {
    rate: 0,
    currency: priceList.currency_code || 'IQD',
    symbol: priceList.currency_symbol || 'IQD',
    inPriceList: false,
  };
}

/**
 * Get price list (basic, compatible)
 */
export async function getPriceList(priceListId: string): Promise<PriceList | null> {
  return getCustomerPriceList(priceListId);
}

/**
 * PRICE_LIST_IDS - In Odoo, these will be fetched dynamically
 * We keep a consumer default for public visitors
 */
export const PRICE_LIST_IDS = {
  CONSUMER: '1', // Default Odoo pricelist - will be overridden at runtime
} as Record<string, string>;

/**
 * PRICE_LIST_INFO - Basic info, dynamically populated from Odoo
 */
export const PRICE_LIST_INFO: Record<string, { name: string; nameAr: string; currency: string; description: string }> = {};
