// ============================================
// Quotations API - Draft/Sent orders for client approval
// ============================================

import { odooSearchRead, odooWrite } from './client';
import type { OdooSaleOrder, OdooSaleOrderLine } from './types';
// quotations lib
import type { SalesOrder } from '@/types';

const ORDER_FIELDS = [
  'id', 'name', 'date_order', 'state', 'partner_id',
  'amount_untaxed', 'amount_tax', 'amount_total',
  'currency_id', 'note', 'order_line', 'create_date', 'write_date',
  'validity_date', 'x_client_approved',
];

const LINE_FIELDS = [
  'id', 'order_id', 'product_id', 'name',
  'product_uom_qty', 'price_unit', 'discount',
  'price_subtotal', 'price_total', 'product_uom',
];

function formatQuotation(o: OdooSaleOrder & { validity_date?: string; x_client_approved?: boolean }, lines: OdooSaleOrderLine[] = []): SalesOrder & { validity_date?: string; client_approved?: boolean } {
  const currencyCode = Array.isArray(o.currency_id) ? o.currency_id[1] : 'IQD';
  return {
    salesorder_id: String(o.id),
    salesorder_number: o.name,
    date: o.date_order ? o.date_order.split(' ')[0] : '',
    status: o.state,
    customer_id: Array.isArray(o.partner_id) ? String(o.partner_id[0]) : '',
    customer_name: Array.isArray(o.partner_id) ? o.partner_id[1] : '',
    total: o.amount_total,
    sub_total: o.amount_untaxed,
    tax_total: o.amount_tax,
    discount: 0,
    shipping_charge: 0,
    currency_code: currencyCode,
    currency_symbol: currencyCode === 'USD' ? '$' : 'IQD',
    exchange_rate: 1,
    notes: (o.note || undefined) as string | undefined,
    line_items: lines.map(l => ({
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
    })),
    created_time: o.create_date,
    last_modified_time: o.write_date,
    validity_date: o.validity_date || undefined,
    client_approved: o.x_client_approved || false,
  };
}

/**
 * Get pending quotations (draft + sent) for a customer
 */
export async function getCustomerQuotations(customerId: string): Promise<(SalesOrder & { validity_date?: string; client_approved?: boolean })[]> {
  try {
    const partnerId = parseInt(customerId, 10);
    const domain = [
      ['partner_id', '=', partnerId],
      ['state', 'in', ['draft', 'sent']],
    ];

    const orders = await odooSearchRead<OdooSaleOrder & { validity_date?: string; x_client_approved?: boolean }>(
      'sale.order', domain, ORDER_FIELDS, { order: 'create_date desc' }
    );

    // Fetch lines for all quotations
    const allLineIds = orders.flatMap(o => o.order_line || []);
    let allLines: OdooSaleOrderLine[] = [];
    if (allLineIds.length) {
      allLines = await odooSearchRead<OdooSaleOrderLine>(
        'sale.order.line',
        [['id', 'in', allLineIds]],
        LINE_FIELDS
      );
    }

    return orders.map(o => {
      const lines = allLines.filter(l => {
        const orderId = Array.isArray(l.order_id) ? l.order_id[0] : l.order_id;
        return orderId === o.id;
      });
      return formatQuotation(o, lines);
    });
  } catch (error) {
    console.error('[Quotations] Error:', error);
    return [];
  }
}

/**
 * Reject/cancel a quotation
 */
export async function rejectQuotation(orderId: number, partnerId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const orders = await odooSearchRead<OdooSaleOrder>(
      'sale.order',
      [['id', '=', orderId]],
      ['id', 'state', 'partner_id']
    );

    if (!orders.length) return { success: false, error: 'Order not found' };
    const order = orders[0];

    const orderPartnerId = Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id;
    if (orderPartnerId !== partnerId) return { success: false, error: 'Access denied' };
    if (order.state !== 'draft' && order.state !== 'sent') return { success: false, error: 'Not a quotation' };

    const GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:3010";
    const API_KEY = process.env.API_KEY || "tsh-client-2026-key";
    await fetch(`${GATEWAY_URL}/api/odoo/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ model: "sale.order", method: "action_cancel", args: [[orderId]] }),
    });

    return { success: true };
  } catch (error) {
    console.error('[Quotations] Reject error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Approve a quotation (client portal) — with state guard
 * Only allows approval if order is draft or sent (not sale/cancel/done)
 */
export async function approveQuotation(orderId: number, partnerId: number, approverName?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const orders = await odooSearchRead<OdooSaleOrder & { x_client_approved?: boolean }>(
      'sale.order',
      [['id', '=', orderId]],
      ['id', 'state', 'partner_id', 'x_client_approved']
    );

    if (!orders.length) return { success: false, error: 'الطلب غير موجود' };
    const order = orders[0];

    // Access check
    const orderPartnerId = Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id;
    if (orderPartnerId !== partnerId) return { success: false, error: 'غير مصرّح' };

    // STATE GUARD: only draft/sent can be approved
    if (order.state !== 'draft' && order.state !== 'sent') {
      return { success: false, error: 'لا يمكن الموافقة — الطلب بحالة ' + order.state };
    }

    // Already approved check
    if (order.x_client_approved) {
      return { success: false, error: 'الطلب موافق عليه مسبقاً' };
    }

    // Write approval fields
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await odooWrite('sale.order', [orderId], {
      x_client_approved: true,
      x_client_approved_at: now,
      x_client_approved_by: approverName || 'Client Portal',
    });

    return { success: true };
  } catch (error) {
    console.error('[Quotations] Approve error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'خطأ غير معروف' };
  }
}
