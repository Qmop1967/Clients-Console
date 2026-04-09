// ============================================
// Odoo Products API - Server Only
// ============================================
// Replaces Odoo products API with Odoo product.product
// Maintains same return types (Product, Category) for page compatibility
// ============================================

import { odooSearchRead, odooRead, odooCount, getOdooImageUrl } from './client';
import type { OdooProduct, OdooCategory as OdooCategoryType } from './types';
import type { Product, Category, PaginatedResponse } from '@/types';

// ============================================
// Fields to fetch (avoid fetching image_1920 in lists)
// ============================================

const PRODUCT_LIST_FIELDS = [
  'id', 'name', 'default_code', 'barcode', 'list_price', 'standard_price',
  'type', 'categ_id', 'product_tmpl_id', 'uom_id', 'active', 'sale_ok',
  'qty_available', 'virtual_available', 'free_qty',
  'description_sale', 'weight', 'volume',

];

const PRODUCT_DETAIL_FIELDS = [
  ...PRODUCT_LIST_FIELDS,
  'description',
];

// ============================================
// Conversion: Odoo → Product (for page compatibility)
// ============================================

function odooProductToProduct(p: OdooProduct): Product {
  const templateId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : 0;
  return {
    item_id: String(p.id),
    name: p.name,
    description: (p.description_sale || p.description || undefined) as string | undefined,
    sku: (p.default_code || '') as string,
    unit: Array.isArray(p.uom_id) ? p.uom_id[1] : 'Unit',
    status: p.active && p.sale_ok ? 'active' : 'inactive',
    rate: p.list_price,
    purchase_rate: p.standard_price,
    item_type: p.type === 'product' ? 'inventory' : p.type,
    stock_on_hand: p.qty_available,
    available_stock: p.free_qty ?? p.qty_available,
    category_id: Array.isArray(p.categ_id) ? String(p.categ_id[0]) : undefined,
    category_name: Array.isArray(p.categ_id) ? p.categ_id[1] : undefined,
    brand: undefined,
    // Image: use URL-based approach (image_256 may be empty after import)
    image_name: templateId ? `odoo-${templateId}` : undefined,
    image_document_id: templateId ? String(templateId) : undefined,
    image_url: templateId ? getOdooImageUrl(templateId, '256x256') : undefined,
    minimum_quantity: undefined,
  };
}

function odooCategoryToCategory(c: OdooCategoryType): Category {
  return {
    category_id: String(c.id),
    name: c.name,
    description: c.complete_name,
    parent_category_id: Array.isArray(c.parent_id) ? String(c.parent_id[0]) : undefined,
    is_active: true,
  };
}

// ============================================
// Products API
// ============================================

/**
 * Get products with pagination
 */
export async function getProducts(options: {
  page?: number;
  perPage?: number;
  categoryId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<PaginatedResponse<Product>> {
  const { page = 1, perPage = 50, categoryId, sortBy = 'name', sortOrder = 'asc' } = options;

  try {
    const domain: unknown[] = [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ];

    if (categoryId) {
      domain.push(['categ_id', '=', categoryId]);
    }

    const offset = (page - 1) * perPage;
    const order = `${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;

    const [products, total] = await Promise.all([
      odooSearchRead<OdooProduct>('product.product', domain, PRODUCT_LIST_FIELDS, {
        offset,
        limit: perPage,
        order,
      }),
      odooCount('product.product', domain),
    ]);

    return {
      data: products.map(odooProductToProduct),
      page_context: {
        page,
        per_page: perPage,
        has_more_page: offset + products.length < total,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  } catch (error) {
    console.error('[Odoo Products] Error fetching products:', error);
    return {
      data: [],
      page_context: { page: 1, per_page: perPage, has_more_page: false, total: 0, total_pages: 0 },
    };
  }
}

/**
 * Get all products (no pagination limit)
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const domain = [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ];

    const products = await odooSearchRead<OdooProduct>(
      'product.product', domain, PRODUCT_LIST_FIELDS,
      { order: 'write_date DESC, id DESC', limit: 0 }
    );

    return products.map(odooProductToProduct);
  } catch (error) {
    console.error('[Odoo Products] Error fetching all products:', error);
    return [];
  }
}

/**
 * Get single product by ID
 */
export async function getProductById(id: number | string): Promise<Product | null> {
  try {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) return null;

    const products = await odooRead<OdooProduct>('product.product', [numId], PRODUCT_DETAIL_FIELDS);
    if (!products.length) return null;

    return odooProductToProduct(products[0]);
  } catch (error) {
    console.error(`[Odoo Products] Error fetching product ${id}:`, error);
    return null;
  }
}

/**
 * Search products by name or SKU
 */
export async function searchProducts(
  query: string,
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<Product>> {
  try {
    const domain = [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
      '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query],
    ];

    const offset = (page - 1) * perPage;

    const [products, total] = await Promise.all([
      odooSearchRead<OdooProduct>('product.product', domain, PRODUCT_LIST_FIELDS, {
        offset,
        limit: perPage,
        order: 'write_date DESC, id DESC',
      }),
      odooCount('product.product', domain),
    ]);

    return {
      data: products.map(odooProductToProduct),
      page_context: {
        page,
        per_page: perPage,
        has_more_page: offset + products.length < total,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  } catch (error) {
    console.error('[Odoo Products] Error searching products:', error);
    return {
      data: [],
      page_context: { page: 1, per_page: perPage, has_more_page: false, total: 0, total_pages: 0 },
    };
  }
}

/**
 * Get product categories
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const categories = await odooSearchRead<OdooCategoryType>(
      'product.category',
      [], // all categories
      ['id', 'name', 'complete_name', 'parent_id', 'child_id', 'product_count'],
      { order: 'write_date DESC, id DESC' }
    );

    return categories.map(odooCategoryToCategory);
  } catch (error) {
    console.error('[Odoo Products] Error fetching categories:', error);
    return [];
  }
}

/**
 * Get products by category
 */
export async function getProductsByCategory(
  categoryId: number | string,
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<Product>> {
  const numCatId = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
  return getProducts({ page, perPage, categoryId: numCatId });
}

/**
 * Get product image URL
 * Odoo stores images as base64 in image_1920 field
 * We use the /web/image/ controller URL instead
 */
export function getProductImageUrl(item: Product): string | null {
  if (item.image_document_id) {
    return getOdooImageUrl(parseInt(item.image_document_id, 10), '256x256');
  }
  return null;
}

/**
 * Get total product count
 */
export async function getProductCount(): Promise<number> {
  try {
    return await odooCount('product.product', [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ]);
  } catch (error) {
    console.error('[Odoo Products] Error counting products:', error);
    return 0;
  }
}

// Alias for backward compatibility
export const getProduct = getProductById;

/**
 * Get direct image URLs (no-op for Odoo since images are served via /web/image/)
 */
export async function getDirectImageUrls(itemIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const id of itemIds) {
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      // For Odoo, product image URLs are direct
      const item = await getProductById(numId);
      if (item?.image_url) {
        map.set(id, item.image_url);
      }
    }
  }
  return map;
}

/**
 * Get products with prices from customer's pricelist
 * Replaces the legacy getProductsWithPrices function
 */
export async function getProductsWithPrices(pricelistId: string): Promise<{
  products: (Product & { display_price: number; in_price_list: boolean })[];
  currency: string;
}> {
  try {
    const { getProductPrices, getPricelistById } = await import('./pricelists');
    const { getAllStock } = await import('./stock');

    // Fetch products, pricelist info, and stock in parallel
    const [allProducts, pricelist, stockMap] = await Promise.all([
      getAllProducts(),
      getPricelistById(parseInt(pricelistId, 10)),
      getAllStock(),
    ]);

    const currency = pricelist && Array.isArray(pricelist.currency_id)
      ? pricelist.currency_id[1] : 'IQD';

    // Get prices for all products
    // Build productId -> templateId map for 1_product pricelist rules
    const productIds = allProducts.map(p => parseInt(p.item_id, 10));
    const templateIdMap = new Map<number, number>();
    for (const p of allProducts) {
      const pid = parseInt(p.item_id, 10);
      const tmplId = p.image_document_id ? parseInt(p.image_document_id, 10) : 0;
      if (tmplId > 0) templateIdMap.set(pid, tmplId);
    }
    const priceMap = await getProductPrices(productIds, parseInt(pricelistId, 10), templateIdMap);

    const products = allProducts.map(p => {
      const pid = parseInt(p.item_id, 10);
      const price = priceMap.get(pid);
      const stock = stockMap.get(pid) ?? 0;

      return {
        ...p,
        display_price: price ?? p.rate,
        in_price_list: price !== undefined,
        available_stock: stock,
      };
    });

    return { products, currency };
  } catch (error) {
    console.error('[Odoo Products] Error getting products with prices:', error);
    return { products: [], currency: 'IQD' };
  }
}

/**
 * Get products with consumer (public) prices
 */
export async function getProductsWithConsumerPrices(): Promise<{
  products: (Product & { display_price: number; in_price_list: boolean })[];
  currency: string;
}> {
  // Use the default pricelist (list_price)
  const allProducts = await getAllProducts();
  const { getAllStock } = await import('./stock');
  const stockMap = await getAllStock();

  const products = allProducts.map(p => {
    const pid = parseInt(p.item_id, 10);
    const stock = stockMap.get(pid) ?? 0;
    return {
      ...p,
      display_price: p.rate,
      in_price_list: true,
      available_stock: stock,
    };
  });

  return { products, currency: 'IQD' };
}

// Aliases for backward compatibility
export const getAllProductsComplete = getAllProducts;
export const getProductsMetadataSafe = getAllProducts;
