// ============================================
// Returns API - Server Only
// ============================================

import { odooSearchRead, odooWrite } from './client';

export interface ReturnRequest {
  id: number;
  order_name: string;
  order_date: string;
  amount: number;
  status: string;
  status_ar: string;
  reason: string;
  return_date: string;
  note: string;
}

const STATUS_AR: Record<string, string> = {
  requested: 'معلق',
  approved: 'مقبول',
  rejected: 'مرفوض',
  completed: 'تم الاسترجاع',
};

export async function getCustomerReturns(customerId: string): Promise<ReturnRequest[]> {
  try {
    const partnerId = parseInt(customerId, 10);
    const orders = await odooSearchRead(
      'sale.order',
      [
        ['partner_id', '=', partnerId],
        ['x_return_requested', '=', true],
      ],
      ['name', 'date_order', 'amount_total', 'x_return_status', 'x_return_reason', 'x_return_date', 'x_return_note'],
      { order: 'x_return_date desc', limit: 100 }
    );

    return orders.map((o: any) => ({
      id: o.id,
      order_name: o.name,
      order_date: o.date_order ? o.date_order.split(' ')[0] : '',
      amount: o.amount_total || 0,
      status: o.x_return_status || 'requested',
      status_ar: STATUS_AR[o.x_return_status] || 'معلق',
      reason: o.x_return_reason || '',
      return_date: o.x_return_date ? o.x_return_date.split(' ')[0] : '',
      note: o.x_return_note || '',
    }));
  } catch (error) {
    console.error('[Returns] Error:', error);
    return [];
  }
}

export async function getEligibleOrders(customerId: string): Promise<any[]> {
  try {
    const partnerId = parseInt(customerId, 10);
    // Eligible: delivered, not already returned, within 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    
    const orders = await odooSearchRead(
      'sale.order',
      [
        ['partner_id', '=', partnerId],
        ['state', 'in', ['sale', 'done']],
        ['x_return_requested', '!=', true],
      ],
      ['name', 'date_order', 'amount_total', 'x_delivery_confirmed', 'x_delivery_date'],
      { order: 'date_order desc', limit: 50 }
    );

    return orders.map((o: any) => ({
      id: o.id,
      name: o.name,
      date: o.date_order ? o.date_order.split(' ')[0] : '',
      amount: o.amount_total || 0,
      delivered: o.x_delivery_confirmed || false,
    }));
  } catch (error) {
    console.error('[Returns] Error getting eligible orders:', error);
    return [];
  }
}

export async function submitReturn(orderId: number, reason: string, note?: string): Promise<boolean> {
  try {
    await odooWrite('sale.order', [orderId], {
      x_return_requested: true,
      x_return_status: 'requested',
      x_return_reason: reason,
      x_return_note: note || '',
      x_return_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
    return true;
  } catch (error) {
    console.error('[Returns] Submit error:', error);
    return false;
  }
}
