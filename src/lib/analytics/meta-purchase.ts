import 'server-only';
import { createHmac } from 'node:crypto';
import { odooRead } from '@/lib/odoo/client';
import type { SalesOrder } from '@/types';
import type { MetaServerCustomData } from '@/lib/analytics/meta-server';

interface ProductSkuRow {
  id: number;
  default_code: string | false;
}

/**
 * Produce a stable event ID for retries without disclosing the internal Odoo
 * order identifier to Meta or to the browser.
 */
export function createOpaqueMetaPurchaseEventId(orderId: string | number): string {
  const secret = process.env.META_MEASUREMENT_CONSENT_SECRET || '';
  const normalizedOrderId = String(orderId).trim();
  if (secret.length < 32) {
    throw new Error('Meta measurement consent verification is not configured');
  }
  if (!normalizedOrderId) {
    throw new Error('Cannot create a Meta event ID without an order identifier');
  }

  const digest = createHmac('sha256', secret)
    .update(`meta-purchase:v1:${normalizedOrderId}`)
    .digest('base64url');
  return `tsh_purchase_${digest}`;
}

/**
 * Build Purchase commerce data only from the order Odoo returned after
 * creation. Browser-supplied SKU, rate, and totals are intentionally ignored.
 */
export async function buildAuthoritativeMetaPurchaseData(
  order: SalesOrder
): Promise<MetaServerCustomData> {
  const productIds = [
    ...new Set(
      order.line_items
        .map((line) => Number(line.item_id))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    ),
  ];

  const products = productIds.length
    ? await odooRead<ProductSkuRow>('product.product', productIds, ['id', 'default_code'])
    : [];
  const skuByProductId = new Map(
    products
      .filter(
        (product): product is ProductSkuRow & { default_code: string } =>
          typeof product.default_code === 'string' && product.default_code.trim().length > 0
      )
      .map((product) => [String(product.id), product.default_code.trim()])
  );

  const contents = order.line_items.flatMap((line) => {
    const sku = skuByProductId.get(line.item_id);
    if (!sku || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      return [];
    }
    const unitPrice =
      Number.isFinite(line.item_total) && line.item_total >= 0
        ? line.item_total / line.quantity
        : line.rate;
    return [
      {
        id: sku,
        quantity: line.quantity,
        ...(Number.isFinite(unitPrice) && unitPrice >= 0 ? { item_price: unitPrice } : {}),
      },
    ];
  });

  return {
    ...(contents.length
      ? {
          content_ids: [...new Set(contents.map((item) => item.id))],
          contents,
          content_type: 'product' as const,
        }
      : {}),
    currency: order.currency_code || 'IQD',
    value: Number(order.total),
    num_items: contents.reduce((total, item) => total + item.quantity, 0),
  };
}
