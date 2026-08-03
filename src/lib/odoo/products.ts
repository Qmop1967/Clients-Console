// ============================================
// Odoo Products API - Server Only
// ============================================
// Replaces Odoo products API with Odoo product.product
// Maintains same return types (Product, Category) for page compatibility
// ============================================

import {
  odooSearchRead, odooRead, odooCount, getProductImageOrPlaceholderUrl,
  getImageVersions, getApprovedPublicMedia,
} from './client';
import type { OdooProduct, OdooCategory as OdooCategoryType } from './types';
import type { Product, Category, PaginatedResponse } from '@/types';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

export interface ApprovedPublicProductImage {
  id: number;
  url: string;
  thumbnailUrl: string;
  version: number;
  sequence: number;
  isMain: boolean;
}

export interface PublicImageProduct extends Product {
  list_image_url?: string | null;
  public_image_id?: number;
  public_image_version?: number;
}

export interface PublicCatalogProduct extends PublicImageProduct {
  display_price: number;
  in_price_list: boolean;
}

// ============================================
// Warehouse Product Isolation (Phase C — 2026-04-30)
// ============================================
// tsh-clients is tied to WH=1 only (Khaleel rule).
// Only show products that physically exist in WH=1's stock locations.
// Uses stock.quant child_of lot_stock_id=8 (same logic as gateway).
// ============================================

const WH1_LOT_STOCK_ID = 8; // TSH main warehouse lot_stock_id

let _warehouseProductIdsCache: number[] | null = null;
let _warehouseProductIdsCacheTime = 0;
const WH_CACHE_TTL_MS = 60_000; // 60s — matches gateway cache

async function getWarehouseProductIds(): Promise<number[]> {
  const now = Date.now();
  if (_warehouseProductIdsCache && now - _warehouseProductIdsCacheTime < WH_CACHE_TTL_MS) {
    return _warehouseProductIdsCache;
  }

  try {
    const quants = await odooSearchRead<{ product_id: [number, string] | number }>(
      'stock.quant',
      [
        ['location_id', 'child_of', WH1_LOT_STOCK_ID],
        ['location_id.usage', '=', 'internal'],
        ['quantity', '>', 0],
      ],
      ['product_id'],
      { limit: 50000 }
    );

    const ids = [...new Set(
      quants.map(q => Array.isArray(q.product_id) ? q.product_id[0] : q.product_id)
    )];

    _warehouseProductIdsCache = ids;
    _warehouseProductIdsCacheTime = now;
    console.log('[Products] WH=1 warehouse product IDs cached:', ids.length, 'products');
    return ids;
  } catch (error) {
    console.error('[Products] Failed to fetch warehouse product IDs:', error);
    // Fail-closed: return cached if available, empty array otherwise
    return _warehouseProductIdsCache || [];
  }
}

// ============================================
// Fields to fetch (avoid fetching image_1920 in lists)
// ============================================

const PRODUCT_LIST_FIELDS = [
  'id', 'name', 'default_code', 'barcode', 'list_price', 'standard_price',
  'type', 'categ_id', 'product_tmpl_id', 'uom_id', 'active', 'sale_ok',
  'qty_available', 'virtual_available', 'free_qty', 'create_date',
  'description_sale', 'weight', 'volume',
  'x_name_ar', 'x_name_ckb', 'x_name_kmr', 'x_name_tm',
];

const PRODUCT_DETAIL_FIELDS = [
  ...PRODUCT_LIST_FIELDS,
  'description',
  'x_alias_name',
  'x_more_detail',
  'x_use_cases',
];

// ============================================
// Conversion: Odoo → Product (for page compatibility)
// ============================================

/**
 * Batched image-version map via the gateway (gateway reads ir.attachment; client may not).
 * Map<variantId, version>. Missing => placeholder. ONE gateway call per page.
 */
async function fetchImageVersions(products: OdooProduct[]): Promise<Map<number, number>> {
  return getImageVersions(products.map((p) => p.id));
}

function odooProductToProduct(p: OdooProduct, versionMap?: Map<number, number>): Product {
  const templateId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : 0;
  const imageVersion = versionMap?.get(p.id);
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
    create_date: p.create_date,
    category_id: Array.isArray(p.categ_id) ? String(p.categ_id[0]) : undefined,
    category_name: Array.isArray(p.categ_id) ? p.categ_id[1] : undefined,
    brand: undefined,
    // Image: use pp_id (product_product.id) — gateway resolves to template
    // FIX 2026-05-14: Was passing tmpl_id, caused 64-product collision on storefront.
    // See memory/daily/2026-05-14-clients-image-collision.md and BAN-IMG-CLI-1.
    // image_document_id intentionally keeps tmpl_id — used by pricelist (line ~393).
    image_name: `odoo-${p.id}`,
    image_document_id: templateId ? String(templateId) : undefined, // tmpl_id for pricelist
    // Versioned URL busts browser/edge cache on set-main/unset-main.
    // No version (no image_1920 attachment) => deterministic SVG placeholder (?ph=1),
    // instead of the old null => local gray box. Always pp_id (BAN-IMG-CLI-1).
    // FIX(2026-08-03): 256x256 -> 512x512. Cards render at ~150-200 CSS px, which is
    // 300-600 device px on every phone the storefront actually runs on, so a 256px
    // source was upscaled (and visibly soft) for literally every customer. 512 is the
    // first size that survives a 2x screen; the gateway still Redis-caches it
    // (its cache bound is <=512), so Odoo load is unchanged.
    image_url: getProductImageOrPlaceholderUrl(p.id, '512x512', imageVersion),
    image_version: imageVersion,
    minimum_quantity: undefined,
    alias_name: p.x_alias_name ? String(p.x_alias_name) : undefined,
    localized_names: {
      ar: p.x_name_ar ? String(p.x_name_ar) : undefined,
      ckb: p.x_name_ckb ? String(p.x_name_ckb) : undefined,
      kmr: p.x_name_kmr ? String(p.x_name_kmr) : undefined,
      tm: p.x_name_tm ? String(p.x_name_tm) : undefined,
    },
    more_detail: p.x_more_detail ? String(p.x_more_detail) : undefined,
    use_cases: p.x_use_cases ? String(p.x_use_cases) : undefined,
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
  lang?: string;
} = {}): Promise<PaginatedResponse<Product>> {
  const { page = 1, perPage = 50, categoryId, sortBy = 'name', sortOrder = 'asc', lang } = options;

  try {
    const warehouseProductIds = await getWarehouseProductIds();
    const domain: unknown[] = [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ];
    if (warehouseProductIds.length > 0) {
      domain.push(['id', 'in', warehouseProductIds]);
    } else {
      domain.push(['id', '=', -1]); // No products in WH=1 → empty result
    }

    if (categoryId) {
      domain.push(['categ_id', 'child_of', categoryId]); // child_of for hierarchy
    }

    const offset = (page - 1) * perPage;
    const order = `${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;

    const [products, total] = await Promise.all([
      odooSearchRead<OdooProduct>('product.product', domain, PRODUCT_LIST_FIELDS, {
        offset,
        limit: perPage,
        order,
        lang,
      }),
      odooCount('product.product', domain),
    ]);

    const versionMap = await fetchImageVersions(products);
    return {
      data: products.map((p) => odooProductToProduct(p, versionMap)),
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
export async function getAllProducts(lang?: string): Promise<Product[]> {
  try {
    const warehouseProductIds = await getWarehouseProductIds();
    const domain: unknown[] = [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ];
    if (warehouseProductIds.length > 0) {
      domain.push(['id', 'in', warehouseProductIds]);
    } else {
      domain.push(['id', '=', -1]);
    }

    const products = await odooSearchRead<OdooProduct>(
      'product.product', domain, PRODUCT_LIST_FIELDS,
      { order: 'write_date DESC, id DESC', limit: 0, lang }
    );

    {
      const versionMap = await fetchImageVersions(products);
      return products.map((p) => odooProductToProduct(p, versionMap));
    }
  } catch (error) {
    console.error('[Odoo Products] Error fetching all products:', error);
    return [];
  }
}

function isSafePublicDamImage(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'media.tsh.sale'
      && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Approved public DAM image for each product template. This is the only image
 * source allowed into the anonymous storefront and external catalog feeds.
 */
export async function getApprovedPublicProductImages(
  templateIds: number[]
): Promise<Map<number, ApprovedPublicProductImage>> {
  const result = new Map<number, ApprovedPublicProductImage>();
  const ids = Array.from(new Set(templateIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (!ids.length) return result;

  try {
    const idSet = new Set(ids);
    const media = await getApprovedPublicMedia();
    const candidates = media
      .filter((row) => {
        const mime = String(row.mime_type || '');
        return idSet.has(Number(row.product_template_id))
          && (!mime || mime.startsWith('image/'))
          && isSafePublicDamImage(row.url);
      })
      .sort((a, b) =>
        Number(Boolean(b.is_main)) - Number(Boolean(a.is_main))
        || Number(a.sequence || 99) - Number(b.sequence || 99)
        || a.asset_id - b.asset_id
      );

    for (const row of candidates) {
      const templateId = Number(row.product_template_id || 0);
      if (!templateId || result.has(templateId) || !isSafePublicDamImage(row.url)) continue;
      result.set(templateId, {
        id: row.asset_id,
        url: row.url,
        thumbnailUrl: isSafePublicDamImage(row.thumbnail_url)
          ? String(row.thumbnail_url)
          : row.url,
        version: Number(row.version || 1),
        sequence: Number(row.sequence || 99),
        isMain: Boolean(row.is_main),
      });
    }
  } catch (error) {
    console.error('[Odoo Products] Approved public DAM image lookup failed:', error);
  }

  return result;
}

/**
 * Resolve the image a storefront card should show.
 *
 * Order: DAM-approved public media -> the product's own Odoo image -> the
 * deterministic ?ph=1 SVG placeholder (already applied by odooProductToProduct).
 *
 * CHANGED 2026-07-28: this used to hard-refuse the Odoo image, which meant only the
 * 77 templates carrying DAM media rendered a real photo — the other ~1370 sellable
 * products all collapsed to product-placeholder.svg. Combined with the (now removed)
 * photo filter, the public shop had shrunk to 3 pages.
 *
 * `public_image_id` is still set ONLY for DAM assets. External feeds (the TikTok
 * catalog in api/catalog/tiktok/feed.csv) gate on that field, so raw Odoo imagery
 * never leaks into a third-party catalog — it is on-site only.
 */
function applyPublicImage(
  product: Product,
  image: ApprovedPublicProductImage | undefined
): PublicImageProduct {
  return {
    ...product,
    sku: String(product.sku || '').trim() || `ODOO-PP-${product.item_id}`,
    image_url: image?.url || product.image_url,
    list_image_url: image?.thumbnailUrl || product.image_url,
    image_version: image ? undefined : product.image_version,
    public_image_id: image?.id,
    public_image_version: image?.version,
  };
}

/**
 * All active, sellable, non-service products, including items currently out of
 * stock. This is deliberately separate from the WH1 purchasing list.
 */
export async function getAllPublicProducts(lang?: string): Promise<
  PublicImageProduct[]
> {
  try {
    const products = await odooSearchRead<OdooProduct>(
      'product.product',
      [
        ['sale_ok', '=', true],
        ['active', '=', true],
        ['type', '!=', 'service'],
      ],
      PRODUCT_LIST_FIELDS,
      { order: 'write_date DESC, id DESC', limit: 0, lang }
    );
    const templateIds = products
      .map((p) => Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : 0)
      .filter((id) => id > 0);
    // Both lookups feed applyPublicImage: DAM media wins, the Odoo image_version is
    // the fallback that keeps the rest of the catalog from rendering as placeholders.
    const [imageMap, versionMap] = await Promise.all([
      getApprovedPublicProductImages(templateIds),
      fetchImageVersions(products),
    ]);

    return products.map((p) => {
      const templateId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : 0;
      return applyPublicImage(odooProductToProduct(p, versionMap), imageMap.get(templateId));
    });
  } catch (error) {
    console.error('[Odoo Products] Error fetching public products:', error);
    return [];
  }
}

/** Read one product through the same public eligibility and DAM rules as the list. */
export async function getPublicProductByIdStrict(
  id: number | string,
  lang?: string
): Promise<(Product & { public_image_id?: number; public_image_version?: number }) | null> {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (!Number.isInteger(numId) || numId <= 0) return null;

  const products = await odooSearchRead<OdooProduct>(
    'product.product',
    [
      ['id', '=', numId],
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ],
    PRODUCT_DETAIL_FIELDS,
    { limit: 1, lang }
  );
  if (!products.length) return null;
  const raw = products[0];
  const templateId = Array.isArray(raw.product_tmpl_id) ? raw.product_tmpl_id[0] : 0;
  const [imageMap, versionMap] = await Promise.all([
    getApprovedPublicProductImages(templateId ? [templateId] : []),
    fetchImageVersions(products),
  ]);
  return applyPublicImage(odooProductToProduct(raw, versionMap), imageMap.get(templateId));
}

export const getPublicProductByIdStrictCached = cache(
  (id: number | string, lang?: string) => getPublicProductByIdStrict(id, lang)
);

/**
 * Get single product by ID
 */
export async function getProductById(id: number | string, lang?: string): Promise<Product | null> {
  try {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) return null;

    const products = await odooRead<OdooProduct>('product.product', [numId], PRODUCT_DETAIL_FIELDS, lang ? { lang } : undefined);
    if (!products.length) return null;

    {
      const versionMap = await fetchImageVersions(products);
      return odooProductToProduct(products[0], versionMap);
    }
  } catch (error) {
    console.error(`[Odoo Products] Error fetching product ${id}:`, error);
    return null;
  }
}

/**
 * Strict product read for product DETAIL pages.
 * Unlike getProductById, this does NOT swallow transport errors:
 *   - returns null ONLY when the product genuinely doesn't exist (empty read)
 *   - rethrows gateway/transport errors (e.g. 429 RATE_LIMIT_EXCEEDED, network)
 * so the detail page can tell "not found" (404) apart from "temporarily
 * unavailable" (retry) instead of mis-rendering every transient hiccup as 404.
 */
export async function getProductByIdStrict(id: number | string, lang?: string): Promise<Product | null> {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(numId)) return null;
  const products = await odooRead<OdooProduct>('product.product', [numId], PRODUCT_DETAIL_FIELDS, lang ? { lang } : undefined);
  if (!products.length) return null;
  const versionMap = await fetchImageVersions(products);
  return odooProductToProduct(products[0], versionMap);
}

// Request-scoped memo so generateMetadata + the page component share ONE
// gateway read per request (React cache dedupes identical calls), halving
// detail-page Odoo calls and easing the shared client rate-limit budget.
export const getProductByIdStrictCached = cache(
  (id: number | string, lang?: string) => getProductByIdStrict(id, lang)
);

/**
 * Search products by name or SKU
 */
export async function searchProducts(
  query: string,
  page = 1,
  perPage = 50,
  lang?: string
): Promise<PaginatedResponse<Product>> {
  try {
    const warehouseProductIds = await getWarehouseProductIds();
    const domain: unknown[] = [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ];
    if (warehouseProductIds.length > 0) {
      domain.push(['id', 'in', warehouseProductIds]);
    } else {
      domain.push(['id', '=', -1]);
    }
    domain.push('|', ['name', 'ilike', query], ['default_code', 'ilike', query]);

    const offset = (page - 1) * perPage;

    const [products, total] = await Promise.all([
      odooSearchRead<OdooProduct>('product.product', domain, PRODUCT_LIST_FIELDS, {
        offset,
        limit: perPage,
        order: 'write_date DESC, id DESC',
        lang,
      }),
      odooCount('product.product', domain),
    ]);

    const versionMap = await fetchImageVersions(products);
    return {
      data: products.map((p) => odooProductToProduct(p, versionMap)),
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
export async function getCategories(lang?: string): Promise<Category[]> {
  try {
    const categories = await odooSearchRead<OdooCategoryType>(
      'product.category',
      [], // all categories
      ['id', 'name', 'complete_name', 'parent_id', 'child_id', 'product_count'],
      { order: 'write_date DESC, id DESC', lang }
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
  perPage = 50,
  lang?: string
): Promise<PaginatedResponse<Product>> {
  const numCatId = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
  return getProducts({ page, perPage, categoryId: numCatId, lang });
}

/**
 * Get product image URL
 * Uses item.item_id which is product_product.id (pp_id) per gateway contract.
 * FIX 2026-05-14: Was using image_document_id (tmpl_id), caused collision.
 * Gateway /api/image/product/:id expects pp_id and resolves to template internally.
 */
export function getProductImageUrl(item: Product): string | null {
  if (item.item_id) {
    // No image_version => deterministic SVG placeholder (?ph=1) rather than a real-image
    // request that 404s into the gray box. pp_id per gateway contract (BAN-IMG-CLI-1).
    return getProductImageOrPlaceholderUrl(parseInt(item.item_id, 10), '512x512', item.image_version);
  }
  return null;
}

/**
 * Get total product count
 */
export async function getProductCount(): Promise<number> {
  try {
    const warehouseProductIds = await getWarehouseProductIds();
    const domain: unknown[] = [
      ['sale_ok', '=', true],
      ['active', '=', true],
      ['type', '!=', 'service'],
    ];
    if (warehouseProductIds.length > 0) {
      domain.push(['id', 'in', warehouseProductIds]);
    } else {
      domain.push(['id', '=', -1]);
    }
    return await odooCount('product.product', domain);
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
export async function getProductsWithPrices(pricelistId: string, lang?: string): Promise<{
  products: (Product & { display_price: number; in_price_list: boolean; carton_qty?: number })[];
  currency: string;
}> {
  try {
    const { getProductPrices, getPricelistById } = await import('./pricelists');
    const { getAllStock } = await import('./stock');

    // Fetch products, pricelist info, and stock in parallel
    const [allProducts, pricelist, stockMap] = await Promise.all([
      getAllProducts(lang),
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

    // Carton hint (2026-07-17): product.packaging qty per variant — wholesale
    // buyers think in cartons. Smallest qty > 1 wins (the "carton", not pallet).
    // Sparse data is fine: cards render the carton line only when present.
    const packagingMap = new Map<number, number>();
    try {
      const pkgs = await odooSearchRead<{ product_id: [number, string] | number; qty: number }>(
        'product.packaging',
        [['product_id', 'in', productIds]],
        ['product_id', 'qty'],
        { limit: 0 }
      );
      for (const pkg of pkgs) {
        const pid = Array.isArray(pkg.product_id) ? pkg.product_id[0] : pkg.product_id;
        const qty = Number(pkg.qty) || 0;
        if (pid && qty > 1) {
          const cur = packagingMap.get(pid);
          if (!cur || qty < cur) packagingMap.set(pid, qty);
        }
      }
    } catch (pkgError) {
      console.error('[Odoo Products] packaging fetch failed (carton hints skipped):', pkgError);
    }

    const products = allProducts.map(p => {
      const pid = parseInt(p.item_id, 10);
      const price = priceMap.get(pid);
      const stock = stockMap.get(pid) ?? 0;

      return {
        ...p,
        display_price: price ?? p.rate,
        in_price_list: price !== undefined,
        available_stock: stock,
        carton_qty: packagingMap.get(pid),
      };
    });

    return { products, currency };
  } catch (error) {
    console.error('[Odoo Products] Error getting products with prices:', error);
    return { products: [], currency: 'IQD' };
  }
}

/**
 * Price the complete public catalog from an explicit Odoo pricelist. Missing
 * fixed prices remain unavailable instead of falling back to internal list_price.
 */
export async function getPublicProductsWithPrices(
  pricelistId: string,
  lang?: string,
  enforcePublicPriceRules = true
): Promise<{
  products: (PublicCatalogProduct & { carton_qty?: number })[];
  currency: string;
}> {
  try {
    const { getProductPrices, getPricelistById, isValidPublicPrice } = await import('./pricelists');
    const { getAllStock } = await import('./stock');
    const numericPricelistId = parseInt(pricelistId, 10);

    const [allProducts, pricelist, stockMap] = await Promise.all([
      getAllPublicProducts(lang),
      Number.isInteger(numericPricelistId) ? getPricelistById(numericPricelistId) : Promise.resolve(null),
      getAllStock(),
    ]);

    const currency = pricelist && Array.isArray(pricelist.currency_id)
      ? String(pricelist.currency_id[1] || 'IQD')
      : 'IQD';
    const productIds = allProducts.map((product) => parseInt(product.item_id, 10));
    const templateIdMap = new Map<number, number>();
    for (const product of allProducts) {
      const productId = parseInt(product.item_id, 10);
      const templateId = product.image_document_id ? parseInt(product.image_document_id, 10) : 0;
      if (templateId > 0) templateIdMap.set(productId, templateId);
    }
    const priceMap = Number.isInteger(numericPricelistId)
      ? await getProductPrices(productIds, numericPricelistId, templateIdMap)
      : new Map<number, number>();

    const packagingMap = new Map<number, number>();
    try {
      const packages = await odooSearchRead<{ product_id: [number, string] | number; qty: number }>(
        'product.packaging',
        [['product_id', 'in', productIds]],
        ['product_id', 'qty'],
        { limit: 0 }
      );
      for (const pkg of packages) {
        const productId = Array.isArray(pkg.product_id) ? pkg.product_id[0] : pkg.product_id;
        const qty = Number(pkg.qty) || 0;
        const current = packagingMap.get(productId);
        if (productId && qty > 1 && (!current || qty < current)) packagingMap.set(productId, qty);
      }
    } catch (error) {
      console.error('[Odoo Products] Public packaging lookup failed:', error);
    }

    const products = allProducts.map((product) => {
      const productId = parseInt(product.item_id, 10);
      const price = priceMap.get(productId);
      const numericPrice = Number(price);
      const hasValidPrice = enforcePublicPriceRules
        ? isValidPublicPrice(numericPrice, currency)
        : Number.isFinite(numericPrice) && numericPrice > 0;
      return {
        ...product,
        display_price: hasValidPrice ? numericPrice : 0,
        in_price_list: hasValidPrice,
        available_stock: stockMap.get(productId) ?? 0,
        carton_qty: packagingMap.get(productId),
      };
    });

    return { products, currency };
  } catch (error) {
    console.error('[Odoo Products] Error getting public products with prices:', error);
    return { products: [], currency: 'IQD' };
  }
}

/**
 * Get products with consumer (public) prices
 */
export async function getProductsWithConsumerPrices(lang?: string): Promise<{
  products: (Product & { display_price: number; in_price_list: boolean })[];
  currency: string;
}> {
  // Use the default pricelist (list_price)
  const allProducts = await getAllProducts(lang);
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

// ============================================
// Cached catalog reads (quota-savers) — added 2026-06-01
// Catalog data is non-personalized (keyed only by pricelist tier), so the gateway
// is hit ~once per revalidate window instead of on every SSR render / bot ping.
// Pricing here is pricelist-tier based (not per-customer) so sharing is correct.
// NOTE: stock can be up to `revalidate` seconds stale on browse pages (acceptable; cart re-validates).
// ============================================
export const getProductsWithPricesCached = unstable_cache(
  // lang is a cache-key argument: en_US and ar_001 catalogs cache separately.
  (pricelistId: string, lang?: string) => getProductsWithPrices(pricelistId, lang),
  ['sf-products-with-prices-v2'],
  { revalidate: 60, tags: ['products'] }
);
export const getPublicProductsWithPricesCached = unstable_cache(
  (pricelistId: string, lang?: string, enforcePublicPriceRules = true) =>
    getPublicProductsWithPrices(pricelistId, lang, enforcePublicPriceRules),
  ['public-products-with-prices-v1'],
  { revalidate: 60, tags: ['products', 'public-catalog'] }
);

export const getCategoriesCached = unstable_cache(
  (lang?: string) => getCategories(lang),
  ['sf-categories-v2'],
  { revalidate: 300, tags: ['categories'] }
);
