// ============================================
// Deliveries API - Delivery receipts/pickings
// ============================================

import { odooSearchRead } from './client';

export interface DeliveryReceipt {
  id: number;
  name: string;
  partner_name: string;
  partner_id: number;
  state: string;
  scheduled_date: string;
  date_done: string | false;
  origin: string;
  carrier: string;
  tracking_number: string;
  items: DeliveryItem[];
  total_items: number;
  carrier_name: string;
  receipt_number: string;
  receipt_image: string | null;
}

export interface DeliveryItem {
  id: number;
  product_name: string;
  product_id: number;
  qty_demand: number;
  qty_done: number;
}

/**
 * Get delivery receipts (outgoing pickings in done state) for a customer
 */
export async function getCustomerDeliveries(customerId: string): Promise<DeliveryReceipt[]> {
  try {
    const partnerId = parseInt(customerId, 10);

    // Get done outgoing pickings for this partner
    const pickings = await odooSearchRead<any>(
      'stock.picking',
      [
        ['partner_id', '=', partnerId],
        ['picking_type_code', '=', 'outgoing'],
        ['state', '=', 'done'],
      ],
      [
        'name', 'partner_id', 'state', 'scheduled_date', 'date_done',
        'origin', 'carrier_id', 'carrier_tracking_ref', 'move_ids',
        'x_carrier_name', 'x_carrier_receipt_number', 'x_carrier_receipt_image',
      ],
      { order: 'date_done desc', limit: 50 }
    );

    // Collect all move_ids
    const allMoveIds = pickings.flatMap((p: any) => p.move_ids || []);
    let allMoves: any[] = [];
    if (allMoveIds.length) {
      allMoves = await odooSearchRead<any>(
        'stock.move',
        [['id', 'in', allMoveIds]],
        ['id', 'picking_id', 'product_id', 'product_uom_qty', 'quantity']
      );
    }

    return pickings.map((p: any) => {
      const pickingMoves = allMoves.filter(m => {
        const pickId = Array.isArray(m.picking_id) ? m.picking_id[0] : m.picking_id;
        return pickId === p.id;
      });

      return {
        id: p.id,
        name: p.name,
        partner_name: Array.isArray(p.partner_id) ? p.partner_id[1] : '',
        partner_id: Array.isArray(p.partner_id) ? p.partner_id[0] : p.partner_id,
        state: p.state,
        scheduled_date: p.scheduled_date || '',
        date_done: p.date_done || false,
        origin: p.origin || '',
        carrier: p.carrier_id ? (Array.isArray(p.carrier_id) ? p.carrier_id[1] : '') : '',
        tracking_number: p.carrier_tracking_ref || '',
        carrier_name: (p.x_carrier_name as string) || '',
        receipt_number: (p.x_carrier_receipt_number as string) || '',
        receipt_image: p.x_carrier_receipt_image || null,
        items: pickingMoves.map((m: any) => ({
          id: m.id,
          product_name: Array.isArray(m.product_id) ? m.product_id[1] : '',
          product_id: Array.isArray(m.product_id) ? m.product_id[0] : m.product_id,
          qty_demand: m.product_uom_qty || 0,
          qty_done: m.quantity || 0,
        })),
        total_items: pickingMoves.length,
      };
    });
  } catch (error) {
    console.error('[Deliveries] Error:', error);
    return [];
  }
}

/**
 * Get pending deliveries (assigned state) for delivery confirmation
 */
export async function getPendingDeliveries(customerId: string): Promise<DeliveryReceipt[]> {
  try {
    const partnerId = parseInt(customerId, 10);

    const pickings = await odooSearchRead<any>(
      'stock.picking',
      [
        ['partner_id', '=', partnerId],
        ['picking_type_code', '=', 'outgoing'],
        ['state', 'in', ['done']],
      ],
      [
        'name', 'partner_id', 'state', 'scheduled_date', 'date_done',
        'origin', 'move_ids',
      ],
      { order: 'date_done desc', limit: 50 }
    );

    const allMoveIds = pickings.flatMap((p: any) => p.move_ids || []);
    let allMoves: any[] = [];
    if (allMoveIds.length) {
      allMoves = await odooSearchRead<any>(
        'stock.move',
        [['id', 'in', allMoveIds]],
        ['id', 'picking_id', 'product_id', 'product_uom_qty', 'quantity']
      );
    }

    return pickings.map((p: any) => {
      const pickingMoves = allMoves.filter(m => {
        const pickId = Array.isArray(m.picking_id) ? m.picking_id[0] : m.picking_id;
        return pickId === p.id;
      });

      return {
        id: p.id,
        name: p.name,
        partner_name: Array.isArray(p.partner_id) ? p.partner_id[1] : '',
        partner_id: Array.isArray(p.partner_id) ? p.partner_id[0] : p.partner_id,
        state: p.state,
        scheduled_date: p.scheduled_date || '',
        date_done: p.date_done || false,
        origin: p.origin || '',
        carrier: '',
        tracking_number: '',
        carrier_name: '',
        receipt_number: '',
        receipt_image: null,
        items: pickingMoves.map((m: any) => ({
          id: m.id,
          product_name: Array.isArray(m.product_id) ? m.product_id[1] : '',
          product_id: Array.isArray(m.product_id) ? m.product_id[0] : m.product_id,
          qty_demand: m.product_uom_qty || 0,
          qty_done: m.quantity || 0,
        })),
        total_items: pickingMoves.length,
      };
    });
  } catch (error) {
    console.error('[Deliveries] Pending error:', error);
    return [];
  }
}
