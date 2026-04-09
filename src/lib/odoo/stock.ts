// ============================================
// Odoo Stock API - Server Only
// ============================================
// Replaces Odoo stock cache with Odoo stock.quant
// Uses stock.quant model for warehouse-specific stock levels
// ============================================

import { odooSearchRead } from './client';
import type { OdooStockQuant } from './types';

// Main warehouse location ID in Odoo
// This should be configured per environment
// Default: WH/Stock (internal location of main warehouse)
const MAIN_WAREHOUSE_LOCATION_NAME = 'WH/Stock';

// ============================================
// Stock API
// ============================================

/**
 * Get stock for a specific product (from main warehouse)
 * Returns available quantity (on_hand - reserved)
 */
export async function getProductStock(productId: number | string): Promise<{
  quantity: number;
  reserved: number;
  available: number;
}> {
  try {
    const numId = typeof productId === 'string' ? parseInt(productId, 10) : productId;

    const quants = await odooSearchRead<OdooStockQuant>(
      'stock.quant',
      [
        ['product_id', '=', numId],
        ['location_id.usage', '=', 'internal'], // only internal locations (warehouses)
      ],
      ['product_id', 'location_id', 'quantity', 'reserved_quantity'],
    );

    // Sum across all internal locations (or filter to main warehouse)
    let totalQty = 0;
    let totalReserved = 0;

    for (const q of quants) {
      totalQty += q.quantity || 0;
      totalReserved += q.reserved_quantity || 0;
    }

    return {
      quantity: totalQty,
      reserved: totalReserved,
      available: totalQty - totalReserved,
    };
  } catch (error) {
    console.error(`[Odoo Stock] Error fetching stock for product ${productId}:`, error);
    return { quantity: 0, reserved: 0, available: 0 };
  }
}

/**
 * Get stock for all products (from internal locations)
 * Returns Map of productId → available quantity
 */
export async function getAllStock(): Promise<Map<number, number>> {
  const stockMap = new Map<number, number>();

  try {
    // Fetch all quants for internal locations
    const quants = await odooSearchRead<OdooStockQuant>(
      'stock.quant',
      [
        ['location_id.usage', '=', 'internal'],
        ['quantity', '!=', 0],
      ],
      ['product_id', 'quantity', 'reserved_quantity'],
      { limit: 0 } // no limit
    );

    // Aggregate by product
    for (const q of quants) {
      const pid = Array.isArray(q.product_id) ? q.product_id[0] : 0;
      if (!pid) continue;

      const current = stockMap.get(pid) || 0;
      const available = (q.quantity || 0) - (q.reserved_quantity || 0);
      stockMap.set(pid, current + available);
    }
  } catch (error) {
    console.error('[Odoo Stock] Error fetching all stock:', error);
  }

  return stockMap;
}

/**
 * Get stock for multiple products (batch)
 * Returns Map of productId → available quantity
 */
export async function getStockBulk(productIds: number[]): Promise<Map<number, number>> {
  const stockMap = new Map<number, number>();

  if (!productIds.length) return stockMap;

  try {
    const quants = await odooSearchRead<OdooStockQuant>(
      'stock.quant',
      [
        ['product_id', 'in', productIds],
        ['location_id.usage', '=', 'internal'],
      ],
      ['product_id', 'quantity', 'reserved_quantity'],
    );

    for (const q of quants) {
      const pid = Array.isArray(q.product_id) ? q.product_id[0] : 0;
      if (!pid) continue;

      const current = stockMap.get(pid) || 0;
      const available = (q.quantity || 0) - (q.reserved_quantity || 0);
      stockMap.set(pid, current + available);
    }

    // Ensure all requested IDs have an entry
    for (const pid of productIds) {
      if (!stockMap.has(pid)) stockMap.set(pid, 0);
    }
  } catch (error) {
    console.error('[Odoo Stock] Error fetching stock bulk:', error);
    for (const pid of productIds) stockMap.set(pid, 0);
  }

  return stockMap;
}

/**
 * Get unified stock for a product (compatible)
 * Returns stock and source info
 */
export async function getUnifiedStock(
  productId: number | string,
  _options?: { fetchOnMiss?: boolean; context?: string }
): Promise<{ stock: number; source: string }> {
  const result = await getProductStock(productId);
  return { stock: result.available, source: 'odoo' };
}

/**
 * Get unified stock for multiple products (compatible)
 */
export async function getUnifiedStockBulk(
  productIds: string[]
): Promise<Map<string, number>> {
  const numIds = productIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  const odooMap = await getStockBulk(numIds);

  const result = new Map<string, number>();
  for (const [pid, qty] of odooMap) {
    result.set(String(pid), qty);
  }
  return result;
}
