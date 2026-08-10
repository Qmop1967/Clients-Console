// ============================================
// Customer purchased-product history - Server only
// ============================================
// Canonical source: posted customer invoices and posted credit notes.
// Draft/cancelled orders are deliberately excluded. Consignment stock becomes
// a purchase only after its sale report produces a posted invoice.
// ============================================

import { odooRead, odooSearchRead } from './client';
import { getProductsWithPricesByIds } from './products';
import {
  aggregatePurchaseHistory,
  classifyPurchaseAvailability,
  type ProductPurchaseHistory,
  type PurchaseHistoryLine,
  type PurchaseHistoryMove,
} from './purchase-history-aggregate';

export {
  aggregatePurchaseHistory,
  type ProductPurchaseHistory,
  type PurchaseHistoryAggregation,
  type PurchaseHistoryLine,
  type PurchaseHistoryMove,
} from './purchase-history-aggregate';

export interface PurchasedProduct {
  item_id: string;
  name: string;
  localized_names?: { ar?: string; ckb?: string; kmr?: string; tm?: string };
  sku: string;
  description?: string;
  rate: number;
  available_stock: number;
  image_url?: string | null;
  category_id?: string;
  category_name?: string;
  brand?: string;
  unit: string;
  inPriceList: boolean;
  create_date?: string;
  status: 'active' | 'inactive' | 'archived';
  is_current_product: boolean;
  purchase: ProductPurchaseHistory;
}

export interface PurchasedProductsResult {
  products: PurchasedProduct[];
  currencyCode: string;
  summary: {
    totalProducts: number;
    totalInvoices: number;
    availableProducts: number;
    unavailableProducts: number;
    discontinuedProducts: number;
    lastPurchaseDate: string | null;
  };
  asOf: string;
}

const PURCHASE_HISTORY_CACHE_TTL_MS = 60_000;
const PURCHASE_HISTORY_CACHE_MAX_ENTRIES = 250;
const purchaseHistoryCache = new Map<string, {
  expiresAt: number;
  value: PurchasedProductsResult;
}>();
const purchaseHistoryInflight = new Map<string, Promise<PurchasedProductsResult>>();

function emptyPurchasedProductsResult(currencyCode = 'IQD'): PurchasedProductsResult {
  return {
    products: [],
    currencyCode,
    summary: {
      totalProducts: 0,
      totalInvoices: 0,
      availableProducts: 0,
      unavailableProducts: 0,
      discontinuedProducts: 0,
      lastPurchaseDate: null,
    },
    asOf: new Date().toISOString(),
  };
}

async function readInvoiceLines(
  lineIds: number[],
  lang?: string
): Promise<PurchaseHistoryLine[]> {
  const ids = Array.from(new Set(lineIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (!ids.length) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 500) {
    chunks.push(ids.slice(i, i + 500));
  }

  const results: PurchaseHistoryLine[][] = [];
  // Three concurrent reads keep large accounts fast without flooding the
  // shared gateway with an unbounded Promise.all burst.
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    results.push(...await Promise.all(
      batch.map((chunk) =>
        odooRead<PurchaseHistoryLine>(
          'account.move.line',
          chunk,
          [
            'id', 'move_id', 'product_id', 'name', 'quantity', 'price_unit',
            'price_subtotal', 'product_uom_id', 'display_type',
          ],
          lang ? { lang } : undefined
        )
      )
    ));
  }
  return results.flat();
}

/**
 * Load a customer's complete purchased-product history and reconcile it with
 * the current customer price list and WH=1 availability.
 */
async function loadCustomerPurchasedProducts(
  customerId: string,
  pricelistId: string,
  lang?: string
): Promise<PurchasedProductsResult> {
  const partnerId = Number.parseInt(customerId, 10);
  if (!Number.isInteger(partnerId) || partnerId <= 0) {
    return emptyPurchasedProductsResult();
  }

  try {
    const moves = await odooSearchRead<PurchaseHistoryMove>(
      'account.move',
      [
        ['partner_id', '=', partnerId],
        ['move_type', 'in', ['out_invoice', 'out_refund']],
        ['state', '=', 'posted'],
      ],
      [
        'id', 'name', 'move_type', 'invoice_date', 'create_date',
        'currency_id', 'invoice_line_ids',
      ],
      { order: 'invoice_date desc, id desc', limit: 0 }
    );

    if (!moves.length) return emptyPurchasedProductsResult();

    const lines = await readInvoiceLines(
      moves.flatMap((move) => move.invoice_line_ids || []),
      lang
    );
    const aggregated = aggregatePurchaseHistory(moves, lines);
    if (!aggregated.products.length) return emptyPurchasedProductsResult();

    const productIds = aggregated.products.map((history) => Number(history.productId));
    const currentCatalog = await getProductsWithPricesByIds(productIds, pricelistId, lang);
    const currentById = new Map(currentCatalog.products.map((product) => [product.item_id, product]));

    const products: PurchasedProduct[] = aggregated.products.flatMap((purchase): PurchasedProduct[] => {
      const current = currentById.get(purchase.productId);
      // Service invoice lines (delivery/COD/etc.) are not products that can be
      // reordered. Physical consignment items remain because they are normal
      // product variants and only reach this endpoint after posted invoicing.
      if (current?.item_type === 'service') return [];

      if (!current) {
        return [{
          item_id: purchase.productId,
          name: purchase.historicalName,
          sku: purchase.historicalSku,
          rate: 0,
          available_stock: 0,
          image_url: null,
          unit: purchase.unit,
          inPriceList: false,
          status: 'archived',
          is_current_product: false,
          purchase,
        }];
      }

      return [{
        item_id: current.item_id,
        name: current.name,
        localized_names: current.localized_names,
        sku: current.sku,
        description: current.description,
        rate: current.display_price,
        available_stock: current.available_stock ?? 0,
        image_url: current.image_url,
        category_id: current.category_id,
        category_name: current.category_name,
        brand: current.brand,
        unit: current.unit,
        inPriceList: current.in_price_list,
        create_date: current.create_date,
        status: current.status === 'active' ? 'active' : 'inactive',
        is_current_product: true,
        purchase,
      }];
    });

    const availabilityCounts = products.reduce(
      (counts, product) => {
        counts[classifyPurchaseAvailability(product)] += 1;
        return counts;
      },
      { available: 0, unavailable: 0, discontinued: 0 }
    );
    const purchaseInvoiceNumbers = new Set(
      products.flatMap((product) => product.purchase.invoiceNumbers)
    );
    const lastPurchaseDate = products.reduce(
      (latest, product) => product.purchase.lastPurchaseDate > latest
        ? product.purchase.lastPurchaseDate
        : latest,
      ''
    );

    return {
      products,
      currencyCode: currentCatalog.currency,
      summary: {
        totalProducts: products.length,
        totalInvoices: purchaseInvoiceNumbers.size,
        availableProducts: availabilityCounts.available,
        unavailableProducts: availabilityCounts.unavailable,
        discontinuedProducts: availabilityCounts.discontinued,
        lastPurchaseDate: lastPurchaseDate || null,
      },
      asOf: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Purchase History] Failed to load purchased products:', error);
    // Do not turn an upstream outage into a misleading "no purchases" state.
    // The authenticated API route maps this to a retryable 503 response.
    throw error;
  }
}

/**
 * Short, per-customer cache: history is loaded lazily, and repeated renders in
 * the same minute should not replay a customer's entire invoice ledger. The
 * customer, pricelist, and data language are all part of the isolation key.
 */
export async function getCustomerPurchasedProducts(
  customerId: string,
  pricelistId: string,
  lang?: string
): Promise<PurchasedProductsResult> {
  const cacheKey = `${customerId}:${pricelistId}:${lang || ''}`;
  const now = Date.now();
  const cached = purchaseHistoryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) purchaseHistoryCache.delete(cacheKey);

  const existing = purchaseHistoryInflight.get(cacheKey);
  if (existing) return existing;

  const request = loadCustomerPurchasedProducts(customerId, pricelistId, lang)
    .then((value) => {
      if (purchaseHistoryCache.size >= PURCHASE_HISTORY_CACHE_MAX_ENTRIES) {
        const oldestKey = purchaseHistoryCache.keys().next().value;
        if (oldestKey) purchaseHistoryCache.delete(oldestKey);
      }
      purchaseHistoryCache.set(cacheKey, {
        expiresAt: Date.now() + PURCHASE_HISTORY_CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => purchaseHistoryInflight.delete(cacheKey));

  purchaseHistoryInflight.set(cacheKey, request);
  return request;
}
