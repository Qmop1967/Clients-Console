// ============================================
// Odoo Sales Orders API - Server Only
// ============================================
// Replaces Odoo sales orders API with Odoo sale.order
// Maintains same return types (SalesOrder) for page compatibility
// ============================================

import { odooSearchRead, odooRead, odooCreate, odooCount, odooWrite } from './client';
import type { OdooSaleOrder, OdooSaleOrderLine } from './types';
import type { SalesOrder, LineItem, ShipmentPackage, Shipment, PaginatedResponse } from '@/types';

// ============================================
// Fields
// ============================================

const ORDER_FIELDS = [
  'id', 'name', 'date_order', 'state', 'partner_id',
  'amount_untaxed', 'amount_tax', 'amount_total',
  'currency_id', 'pricelist_id', 'note',
  'order_line', 'invoice_ids', 'delivery_status',
  'create_date', 'write_date',
];

const ORDER_LINE_FIELDS = [
  'id', 'order_id', 'product_id', 'name',
  'product_uom_qty', 'price_unit', 'discount',
  'price_subtotal', 'price_total', 'tax_id', 'product_uom',
];

// ============================================
// State mapping: Odoo → compatible status
// ============================================

const STATE_MAP: Record<string, string> = {
  draft: 'draft',
  sent: 'confirmed',
  sale: 'confirmed',
  done: 'delivered',
  cancel: 'cancelled',
};

// ============================================
// Conversion helpers
// ============================================

function formatOrder(o: OdooSaleOrder, lines: OdooSaleOrderLine[] = []): SalesOrder {
  const currencyCode = Array.isArray(o.currency_id) ? o.currency_id[1] : 'IQD';

  return {
    salesorder_id: String(o.id),
    salesorder_number: o.name,
    date: o.date_order ? o.date_order.split(' ')[0] : '',
    status: STATE_MAP[o.state] || o.state,
    customer_id: Array.isArray(o.partner_id) ? String(o.partner_id[0]) : '',
    customer_name: Array.isArray(o.partner_id) ? o.partner_id[1] : '',
    reference_number: undefined,
    total: o.amount_total,
    sub_total: o.amount_untaxed,
    tax_total: o.amount_tax,
    discount: 0,
    shipping_charge: 0,
    currency_code: currencyCode,
    currency_symbol: currencyCode === 'USD' ? '$' : 'IQD',
    exchange_rate: 1,
    notes: (o.note || undefined) as string | undefined,
    line_items: lines.filter(l => l.product_uom_qty > 0).map(formatLineItem),
    created_time: o.create_date,
    last_modified_time: o.write_date,
  };
}

function formatLineItem(l: OdooSaleOrderLine): LineItem {
  return {
    line_item_id: String(l.id),
    item_id: Array.isArray(l.product_id) ? String(l.product_id[0]) : '',
    item_name: Array.isArray(l.product_id) ? l.product_id[1] : '',
    name: l.name,
    description: l.name,
    rate: l.price_unit,
    quantity: l.product_uom_qty,
    unit: Array.isArray(l.product_uom) ? l.product_uom[1] : 'Unit',
    item_total: l.price_subtotal,
    discount: l.discount,
  };
}

// ============================================
// API Functions
// ============================================

/**
 * Get orders for a customer (paginated)
 */
export async function getCustomerOrders(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<SalesOrder>> {
  try {
    const partnerId = parseInt(customerId, 10);
    const domain = [['partner_id', '=', partnerId]];
    const offset = (page - 1) * perPage;

    const [orders, total] = await Promise.all([
      odooSearchRead<OdooSaleOrder>('sale.order', domain, ORDER_FIELDS, {
        offset,
        limit: perPage,
        order: 'date_order desc, id desc',
      }),
      odooCount('sale.order', domain),
    ]);

    return {
      data: orders.map(o => formatOrder(o)),
      page_context: {
        page,
        per_page: perPage,
        has_more_page: offset + perPage < total,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  } catch (error) {
    console.error('[Odoo Orders] Error fetching orders:', error);
    return {
      data: [],
      page_context: { page: 1, per_page: perPage, has_more_page: false, total: 0, total_pages: 0 },
    };
  }
}

/**
 * Get single order by ID with lines
 */
export async function getOrder(
  orderId: string,
  customerId: string
): Promise<SalesOrder | null> {
  try {
    const numId = parseInt(orderId, 10);
    const orders = await odooRead<OdooSaleOrder>('sale.order', [numId], ORDER_FIELDS);
    if (!orders.length) return null;

    const order = orders[0];

    // Security: verify ownership
    if (Array.isArray(order.partner_id) && String(order.partner_id[0]) !== customerId) {
      console.warn(`[Odoo Orders] Order ${orderId} does not belong to customer ${customerId}`);
      return null;
    }

    // Fetch order lines
    let lines: OdooSaleOrderLine[] = [];
    if (order.order_line?.length) {
      lines = await odooRead<OdooSaleOrderLine>('sale.order.line', order.order_line, ORDER_LINE_FIELDS);
    }

    return formatOrder(order, lines);
  } catch (error) {
    console.error(`[Odoo Orders] Error fetching order ${orderId}:`, error);
    return null;
  }
}

/**
 * Get order lines for an order
 */
export async function getOrderLines(orderId: string): Promise<LineItem[]> {
  try {
    const numId = parseInt(orderId, 10);
    const lines = await odooSearchRead<OdooSaleOrderLine>(
      'sale.order.line',
      [['order_id', '=', numId]],
      ORDER_LINE_FIELDS
    );
    return lines.map(formatLineItem);
  } catch (error) {
    console.error(`[Odoo Orders] Error fetching order lines:`, error);
    return [];
  }
}

/**
 * Create a sales order
 */
export interface CreateOrderResult {
  success: boolean;
  order?: SalesOrder;
  error?: string;
  errorCode?: string;
}

export async function createSalesOrder(data: {
  customer_id: string;
  line_items: Array<{ item_id: string; quantity: number; rate: number }>;
  notes?: string;
  reference_number?: string;
  autoConfirm?: boolean;
  idempotencyKey?: string;
}): Promise<CreateOrderResult> {
  try {
    // Order creation goes through the central gateway, which enforces the
    // customer pricelist price server-side (price integrity). The storefront
    // no longer writes price_unit directly to Odoo.
    const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
    const API_KEY = process.env.API_KEY || '';
    const resp = await fetch(`${GATEWAY_URL}/api/client/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-partner-id': String(data.customer_id),
        ...(data.idempotencyKey ? { 'Idempotency-Key': data.idempotencyKey } : {}),
      },
      cache: 'no-store',
      body: JSON.stringify({
        items: data.line_items.map((li) => ({ item_id: li.item_id, quantity: li.quantity })),
        notes: data.notes || false,
        autoConfirm: data.autoConfirm !== false,
        idempotencyKey: data.idempotencyKey,
      }),
    });
    const gw: any = await resp.json().catch(() => ({}));
    if (!resp.ok || !gw || gw.success !== true || !gw.order_id) {
      return { success: false, error: (gw && gw.error) || 'Failed to create order' };
    }

    // Read back the created order (read path unchanged)
    const order = await getOrder(String(gw.order_id), data.customer_id);
    return { success: true, order: order || undefined };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Odoo Orders] Create failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Get recent orders for dashboard
 */
export async function getRecentOrders(
  customerId: string,
  limit = 5
): Promise<SalesOrder[]> {
  const result = await getCustomerOrders(customerId, 1, limit);
  return result.data;
}

/**
 * Get order stats by status
 */
export async function getOrderStats(customerId: string): Promise<{
  total: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
}> {
  try {
    const partnerId = parseInt(customerId, 10);
    const base = [['partner_id', '=', partnerId]];

    const [total, draft, sent, sale, done] = await Promise.all([
      odooCount('sale.order', base),
      odooCount('sale.order', [...base, ['state', '=', 'draft']]),
      odooCount('sale.order', [...base, ['state', '=', 'sent']]),
      odooCount('sale.order', [...base, ['state', '=', 'sale']]),
      odooCount('sale.order', [...base, ['state', '=', 'done']]),
    ]);

    return {
      total,
      pending: draft + sent,
      confirmed: sale,
      shipped: 0,
      delivered: done,
    };
  } catch (error) {
    console.error('[Odoo Orders] Error getting stats:', error);
    return { total: 0, pending: 0, confirmed: 0, shipped: 0, delivered: 0 };
  }
}

/**
 * Order summary stats (compatible with API version)
 */
export interface OrderSummaryStats {
  totalOrders: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  confirmedCount: number;
  confirmedAmount: number;
  shippedCount: number;
  shippedAmount: number;
  deliveredCount: number;
  deliveredAmount: number;
  invoicedCount: number;
  invoicedAmount: number;
  cancelledCount: number;
}

export async function getOrderSummaryStats(customerId: string): Promise<OrderSummaryStats> {
  try {
    const partnerId = parseInt(customerId, 10);
    const base: unknown[] = [['partner_id', '=', partnerId]];

    const [total, draft, sale, done, cancel] = await Promise.all([
      odooCount('sale.order', base),
      odooCount('sale.order', [...base, ['state', '=', 'draft']]),
      odooCount('sale.order', [...base, ['state', 'in', ['sent', 'sale']]]),
      odooCount('sale.order', [...base, ['state', '=', 'done']]),
      odooCount('sale.order', [...base, ['state', '=', 'cancel']]),
    ]);

    return {
      totalOrders: total,
      totalAmount: 0,
      pendingCount: draft,
      pendingAmount: 0,
      confirmedCount: sale,
      confirmedAmount: 0,
      shippedCount: 0,
      shippedAmount: 0,
      deliveredCount: done,
      deliveredAmount: 0,
      invoicedCount: 0,
      invoicedAmount: 0,
      cancelledCount: cancel,
    };
  } catch (error) {
    console.error('[Odoo Orders] Error getting summary stats:', error);
    return {
      totalOrders: 0, totalAmount: 0,
      pendingCount: 0, pendingAmount: 0,
      confirmedCount: 0, confirmedAmount: 0,
      shippedCount: 0, shippedAmount: 0,
      deliveredCount: 0, deliveredAmount: 0,
      invoicedCount: 0, invoicedAmount: 0,
      cancelledCount: 0,
    };
  }
}

/**
 * Get order with details (packages and shipments)
 * In Odoo, we don't have separate package/shipment tracking like the previous system
 */
export async function getOrderWithDetails(
  orderId: string,
  customerId: string
): Promise<{ order: SalesOrder | null; packages: ShipmentPackage[]; shipments: Shipment[] }> {
  const order = await getOrder(orderId, customerId);
  if (!order) return { order: null, packages: [], shipments: [] };

  // Fetch real pickings from Odoo
  let shipments: Shipment[] = [];
  try {
    const pickings = await odooSearchRead<{
      id: number; name: string; state: string;
      scheduled_date: string | false; date_done: string | false;
      picking_type_id: [number, string] | false;
      x_fulfillment_stage: string | false;
      x_handoff_state: string | false;
      x_handoff_date: string | false;
      x_handoff_confirm_code: string | false;
      x_package_count: number;
      x_package_count_actual: number;
      x_carrier_name: string | false;
      x_carrier_receipt_number: string | false;
      x_handoff_notes: string | false;
    }>('stock.picking', [['origin', '=', order.salesorder_number]], [
      'name', 'state', 'scheduled_date', 'date_done', 'picking_type_id',
      'x_fulfillment_stage', 'x_handoff_state', 'x_handoff_date',
      'x_handoff_confirm_code', 'x_package_count', 'x_package_count_actual',
      'x_carrier_name', 'x_carrier_receipt_number', 'x_handoff_notes',
    ], { order: 'id asc' });

    shipments = pickings.map((p) => ({
      shipment_id: String(p.id),
      shipment_number: p.name,
      salesorder_id: order.salesorder_number,
      package_ids: [],
      date: (p.scheduled_date as string) || '',
      delivery_date: (p.date_done as string) || undefined,
      carrier: (p.x_carrier_name as string) || '',
      status: p.state === 'done' ? 'delivered' : p.state === 'cancel' ? 'cancelled' : 'in_transit',
      created_time: (p.scheduled_date as string) || '',
      last_modified_time: (p.date_done as string) || '',
      fulfillment_stage: (p.x_fulfillment_stage as string) || '',
      handoff_state: (p.x_handoff_state as string) || '',
      handoff_date: (p.x_handoff_date as string) || '',
      handoff_code: (p.x_handoff_confirm_code as string) || '',
      package_count: p.x_package_count || 0,
      package_count_actual: p.x_package_count_actual || 0,
      carrier_name: (p.x_carrier_name as string) || '',
      receipt_number: (p.x_carrier_receipt_number as string) || '',
      handoff_notes: (p.x_handoff_notes as string) || '',
    }));
  } catch (e) {
    console.error('[getOrderWithDetails] Failed to fetch pickings:', e);
  }

  return { order, packages: [], shipments };
}

// Status mapping for UI
export const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  confirmed: { label: 'Confirmed', color: 'blue' },
  shipped: { label: 'Shipped', color: 'indigo' },
  delivered: { label: 'Delivered', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
};

// ============================================
// Quotation Approval
// ============================================


/**
 * Approve a quotation (draft sale.order) by client
 */
export async function approveQuotation(orderId: number, partnerId: number): Promise<{
  success: boolean;
  needsAdminApproval: boolean;
  error?: string;
}> {
  try {
    // Read order to verify ownership and state
    const orders = await odooRead<OdooSaleOrder & {
      x_client_approved?: boolean;
      x_needs_admin_approval?: boolean;
      x_revision_number?: number;
    }>('sale.order', [orderId], [
      ...ORDER_FIELDS,
      'x_client_approved',
      'x_needs_admin_approval',
      'x_revision_number',
    ]);

    if (!orders.length) {
      return { success: false, needsAdminApproval: false, error: 'Order not found' };
    }

    const order = orders[0];

    // Verify ownership
    const orderPartnerId = Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id;
    if (orderPartnerId !== partnerId) {
      return { success: false, needsAdminApproval: false, error: 'Order does not belong to this customer' };
    }

    // Verify it's a draft
    if (order.state !== 'draft' && order.state !== 'sent') {
      return { success: false, needsAdminApproval: false, error: 'Order is not a quotation' };
    }

    // Route the customer confirmation through the gateway negotiation endpoint.
    // Guards, revalidation, stock check, price-gate, audit, and admin-routing all live there.
    const GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:3010";
    const API_KEY = process.env.API_KEY || "";
    const revision = Number((order as any).x_revision_number || 0);
    const resp = await fetch(`${GATEWAY_URL}/api/orders/${orderId}/nego/customer-confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-partner-id": String(partnerId),
      },
      body: JSON.stringify({
        expected_revision_number: revision,
        idempotency_key: `confirm-${orderId}-${revision}`,
      }),
    });
    const data = await resp.json().catch(() => ({} as any));
    if (!resp.ok || !data?.success) {
      return {
        success: false,
        needsAdminApproval: false,
        error: data?.message || data?.code || `confirm failed (${resp.status})`,
      };
    }
    return { success: true, needsAdminApproval: Boolean(data.needs_admin) };
  } catch (error) {
    console.error(`[Odoo Orders] approveQuotation error:`, error);
    return {
      success: false,
      needsAdminApproval: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Draft Order Merge — Smart Cart Integration
// ============================================

export interface DraftOrderSummary {
  id: number;
  name: string;
  date: string;
  state: string;
  itemCount: number;
  total: number;
  currencyCode: string;
  lines: Array<{
    lineId: number;
    productId: number;
    productName: string;
    quantity: number;
    priceUnit: number;
    subtotal: number;
  }>;
}

/**
 * Get draft/sent orders for a customer (for merge detection)
 * Only returns orders created within last 7 days to keep it relevant
 */
export async function getDraftOrdersForMerge(customerId: string): Promise<DraftOrderSummary[]> {
  try {
    const partnerId = parseInt(customerId, 10);
    if (isNaN(partnerId)) return [];

    // Only draft orders from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().replace('T', ' ').slice(0, 19);

    const domain = [
      ['partner_id', '=', partnerId],
      ['state', 'in', ['draft', 'sent']],
      ['create_date', '>=', dateStr],
    ];

    const orders = await odooSearchRead<OdooSaleOrder>(
      'sale.order', domain,
      ['id', 'name', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line', 'create_date'],
      { order: 'create_date desc', limit: 5 }
    );

    if (!orders.length) return [];

    // Fetch all lines
    const allLineIds = orders.flatMap(o => o.order_line || []);
    let allLines: OdooSaleOrderLine[] = [];
    if (allLineIds.length) {
      allLines = await odooSearchRead<OdooSaleOrderLine>(
        'sale.order.line',
        [['id', 'in', allLineIds]],
        ['id', 'order_id', 'product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal']
      );
    }

    return orders.map(o => {
      const orderLines = allLines.filter(l => {
        const oid = Array.isArray(l.order_id) ? l.order_id[0] : l.order_id;
        return oid === o.id;
      });

      return {
        id: o.id,
        name: o.name,
        date: o.date_order ? o.date_order.split(' ')[0] : '',
        state: o.state,
        itemCount: orderLines.length,
        total: o.amount_total,
        currencyCode: Array.isArray(o.currency_id) ? o.currency_id[1] : 'IQD',
        lines: orderLines.map(l => ({
          lineId: l.id,
          productId: Array.isArray(l.product_id) ? l.product_id[0] : 0,
          productName: Array.isArray(l.product_id) ? l.product_id[1] : '',
          quantity: l.product_uom_qty,
          priceUnit: l.price_unit,
          subtotal: l.price_subtotal,
        })),
      };
    });
  } catch (error) {
    console.error('[Odoo Orders] getDraftOrdersForMerge error:', error);
    return [];
  }
}

export interface MergeResult {
  success: boolean;
  order?: SalesOrder;
  addedCount?: number;
  updatedCount?: number;
  error?: string;
}

/**
 * Merge cart items into an existing draft order.
 * - If product already exists in order: increment quantity
 * - If product is new: add new line
 * - Appends merge note to order
 */
export async function mergeToDraftOrder(data: {
  orderId: number;
  customerId: string;
  items: Array<{ item_id: string; quantity: number; rate: number; name: string }>;
  notes?: string;
}): Promise<MergeResult> {
  try {
    // Merge goes through the central gateway, which enforces pricelist prices
    // for newly-added lines server-side. No direct price writes from the storefront.
    const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
    const API_KEY = process.env.API_KEY || '';
    const resp = await fetch(`${GATEWAY_URL}/api/client/orders/${data.orderId}/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-partner-id': String(data.customerId),
      },
      cache: 'no-store',
      body: JSON.stringify({
        items: data.items.map((it) => ({ item_id: it.item_id, quantity: it.quantity })),
        notes: data.notes,
      }),
    });
    const gw: any = await resp.json().catch(() => ({}));
    if (!resp.ok || !gw || gw.success !== true) {
      return { success: false, error: (gw && gw.error) || 'Failed to merge items' };
    }
    const updatedOrder = await getOrder(String(data.orderId), data.customerId);
    return {
      success: true,
      order: updatedOrder || undefined,
      addedCount: typeof gw.addedCount === 'number' ? gw.addedCount : 0,
      updatedCount: typeof gw.updatedCount === 'number' ? gw.updatedCount : 0,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Odoo Orders] mergeToDraftOrder error:', msg);
    return { success: false, error: msg };
  }
}
