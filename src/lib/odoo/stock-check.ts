// ============================================
// Stock Check API - Server Only
// ============================================

import { odooSearchRead } from './client';

export interface StockProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  qty_available: number;
  availability: 'available' | 'out_of_stock' | 'limited';
  availability_ar: string;
  category: string;
}

export async function searchProductStock(query: string): Promise<StockProduct[]> {
  try {
    if (!query || query.length < 2) return [];

    const products = await odooSearchRead(
      'product.product',
      [
        ['active', '=', true],
        ['sale_ok', '=', true],
        '|',
        ['name', 'ilike', query],
        ['default_code', 'ilike', query],
      ],
      ['name', 'default_code', 'list_price', 'qty_available', 'categ_id'],
      { limit: 20, order: 'name asc' }
    );

    return products.map((p: any) => {
      let availability: 'available' | 'out_of_stock' | 'limited' = 'available';
      let availability_ar = 'متوفر';
      const qty = p.qty_available || 0;

      if (qty <= 0) {
        availability = 'out_of_stock';
        availability_ar = 'غير متوفر';
      } else if (qty < 10) {
        availability = 'limited';
        availability_ar = 'كمية محدودة';
      }

      return {
        id: p.id,
        name: p.name || '',
        sku: p.default_code || '',
        price: p.list_price || 0,
        qty_available: qty,
        availability,
        availability_ar,
        category: Array.isArray(p.categ_id) ? p.categ_id[1] : '',
      };
    });
  } catch (error) {
    console.error('[StockCheck] Error:', error);
    return [];
  }
}
