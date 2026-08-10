// ============================================
// Purchased-product history aggregation (pure)
// ============================================
// This module deliberately has no Odoo, Next.js, or session imports so its
// invoice/refund accounting can be executed by the built-in Node test runner.

type Relation = [number, string] | false;

export interface PurchaseHistoryMove {
  id: number;
  name: string;
  move_type: 'out_invoice' | 'out_refund';
  invoice_date: string | false;
  create_date?: string;
  currency_id: Relation;
  invoice_line_ids: number[];
}

export interface PurchaseHistoryLine {
  id: number;
  move_id: Relation;
  product_id: Relation;
  name: string;
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  product_uom_id: Relation;
  display_type: string | false;
}

export interface ProductPurchaseHistory {
  productId: string;
  historicalName: string;
  historicalSku: string;
  unit: string;
  purchaseCount: number;
  invoiceNumbers: string[];
  purchasedQuantity: number;
  returnedQuantity: number;
  netQuantity: number;
  lastPurchaseDate: string;
  lastInvoiceId: string;
  lastInvoiceNumber: string;
  lastQuantity: number;
  lastUnitPrice: number;
  lastCurrencyCode: string;
}

export interface PurchaseHistoryAggregation {
  products: ProductPurchaseHistory[];
  totalInvoices: number;
  lastPurchaseDate: string | null;
}

export type PurchaseAvailability = 'available' | 'unavailable' | 'discontinued';

export function classifyPurchaseAvailability(product: {
  status: 'active' | 'inactive' | 'archived';
  is_current_product: boolean;
  available_stock: number;
  inPriceList: boolean;
  rate: number;
}): PurchaseAvailability {
  if (!product.is_current_product || product.status !== 'active') return 'discontinued';
  if (product.available_stock > 0 && product.inPriceList && product.rate > 0) return 'available';
  return 'unavailable';
}

interface GroupedMoveLine {
  productId: number;
  moveId: number;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  subtotal: number;
}

interface MutableHistory extends ProductPurchaseHistory {
  invoiceIds: Set<number>;
  invoiceNumbersSet: Set<string>;
  lastMoveId: number;
}

function relationId(value: Relation): number | null {
  return Array.isArray(value) && Number.isInteger(value[0]) ? value[0] : null;
}

function relationLabel(value: Relation): string {
  return Array.isArray(value) ? String(value[1] || '') : '';
}

function cleanLineName(rawName: string, productLabel: string): string {
  const firstLine = String(rawName || '').split('\n')[0].trim();
  const fallback = String(productLabel || '').trim();
  return (firstLine || fallback).replace(/^\s*\[[^\]]+]\s*/, '').trim();
}

function extractSku(label: string): string {
  const match = String(label || '').match(/^\s*\[([^\]]+)]/);
  return match?.[1]?.trim() || '';
}

function moveDate(move: PurchaseHistoryMove): string {
  const value = move.invoice_date || move.create_date || '';
  return value ? String(value).split(' ')[0] : '';
}

/**
 * Aggregate posted customer invoices and credit notes by product variant.
 * A purchase count is the number of distinct sales invoices, while credit
 * notes reduce net quantity without creating a purchase of their own.
 */
export function aggregatePurchaseHistory(
  moves: PurchaseHistoryMove[],
  lines: PurchaseHistoryLine[]
): PurchaseHistoryAggregation {
  const moveById = new Map(moves.map((move) => [move.id, move]));
  const grouped = new Map<string, GroupedMoveLine>();

  for (const line of lines) {
    if (line.display_type && line.display_type !== 'product') continue;

    const productId = relationId(line.product_id);
    const moveId = relationId(line.move_id);
    if (!productId || !moveId) continue;

    const move = moveById.get(moveId);
    if (!move || !['out_invoice', 'out_refund'].includes(move.move_type)) continue;

    const quantity = Math.abs(Number(line.quantity) || 0);
    if (quantity <= 0) continue;

    const productLabel = relationLabel(line.product_id);
    const sku = extractSku(productLabel) || extractSku(line.name);
    const name = cleanLineName(line.name, productLabel);
    const key = `${productId}:${moveId}`;
    const current = grouped.get(key);
    const subtotal = Math.abs(Number(line.price_subtotal) || 0);

    if (current) {
      current.quantity += quantity;
      current.subtotal += subtotal;
      if (!current.name && name) current.name = name;
      if (!current.sku) current.sku = sku;
    } else {
      grouped.set(key, {
        productId,
        moveId,
        name,
        sku,
        unit: relationLabel(line.product_uom_id) || 'Unit',
        quantity,
        subtotal,
      });
    }
  }

  const histories = new Map<number, MutableHistory>();
  const allInvoiceIds = new Set<number>();
  let latestPurchaseDate = '';

  for (const group of grouped.values()) {
    const move = moveById.get(group.moveId);
    if (!move) continue;

    let history = histories.get(group.productId);
    if (!history) {
      history = {
        productId: String(group.productId),
        historicalName: group.name,
        historicalSku: group.sku,
        unit: group.unit,
        purchaseCount: 0,
        invoiceNumbers: [],
        purchasedQuantity: 0,
        returnedQuantity: 0,
        netQuantity: 0,
        lastPurchaseDate: '',
        lastInvoiceId: '',
        lastInvoiceNumber: '',
        lastQuantity: 0,
        lastUnitPrice: 0,
        lastCurrencyCode: 'IQD',
        invoiceIds: new Set<number>(),
        invoiceNumbersSet: new Set<string>(),
        lastMoveId: 0,
      };
      histories.set(group.productId, history);
    }

    if (!history.historicalName && group.name) history.historicalName = group.name;
    if (!history.historicalSku && group.sku) history.historicalSku = group.sku;

    if (move.move_type === 'out_refund') {
      // This is the quantity credited on a posted customer credit note. It is
      // the accounting net quantity; it does not claim a physical stock return.
      history.returnedQuantity += group.quantity;
      continue;
    }

    history.purchasedQuantity += group.quantity;
    history.invoiceIds.add(move.id);
    if (move.name) history.invoiceNumbersSet.add(move.name);
    allInvoiceIds.add(move.id);

    const date = moveDate(move);
    const isNewer = date > history.lastPurchaseDate
      || (date === history.lastPurchaseDate && move.id > history.lastMoveId);

    if (isNewer) {
      history.lastPurchaseDate = date;
      history.lastInvoiceId = String(move.id);
      history.lastInvoiceNumber = move.name || '';
      history.lastQuantity = group.quantity;
      history.lastUnitPrice = group.quantity > 0 ? group.subtotal / group.quantity : 0;
      history.lastCurrencyCode = relationLabel(move.currency_id) || 'IQD';
      history.lastMoveId = move.id;
    }

    if (date > latestPurchaseDate) latestPurchaseDate = date;
  }

  const products = Array.from(histories.values())
    .filter((history) => history.invoiceIds.size > 0)
    .map((history): ProductPurchaseHistory => ({
      productId: history.productId,
      historicalName: history.historicalName,
      historicalSku: history.historicalSku,
      unit: history.unit,
      purchaseCount: history.invoiceIds.size,
      invoiceNumbers: Array.from(history.invoiceNumbersSet),
      purchasedQuantity: history.purchasedQuantity,
      returnedQuantity: history.returnedQuantity,
      netQuantity: history.purchasedQuantity - history.returnedQuantity,
      lastPurchaseDate: history.lastPurchaseDate,
      lastInvoiceId: history.lastInvoiceId,
      lastInvoiceNumber: history.lastInvoiceNumber,
      lastQuantity: history.lastQuantity,
      lastUnitPrice: history.lastUnitPrice,
      lastCurrencyCode: history.lastCurrencyCode,
    }))
    .sort((a, b) =>
      b.purchaseCount - a.purchaseCount
      || b.lastPurchaseDate.localeCompare(a.lastPurchaseDate)
      || Number(b.productId) - Number(a.productId)
    );

  return {
    products,
    totalInvoices: allInvoiceIds.size,
    lastPurchaseDate: latestPurchaseDate || null,
  };
}
