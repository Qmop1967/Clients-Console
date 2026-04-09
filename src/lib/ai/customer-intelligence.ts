// ============================================
// TSH Clients Console - Customer Intelligence
// Business context and order history for AI (Odoo)
// ============================================

import { getCustomerById } from '@/lib/odoo/customers';
import { getCustomerOrders as getOdooOrders } from '@/lib/odoo/orders';
import { getCustomerInvoices as getOdooInvoices } from '@/lib/odoo/invoices';
import { getUnifiedStock } from '@/lib/odoo/stock';

export interface CustomerContext {
  customerId: string;
  name: string;
  email: string;
  priceListId: string;
  priceListName: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
  outstandingBalance: number;
  creditLimit?: number;
  preferredCategories: string[];
  topProducts: Array<{ item_id: string; name: string; orderCount: number }>;
}

export interface OrderInfo {
  salesorder_id: string;
  salesorder_number: string;
  date: string;
  total: number;
  status: string;
  delivery_date?: string;
  line_items: Array<{ item_id: string; name: string; quantity: number; rate: number; total: number }>;
}

export interface InvoiceInfo {
  invoice_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  total: number;
  balance: number;
  status: string;
}

export async function getCustomerContext(customerId: string): Promise<CustomerContext | null> {
  try {
    const customer = await getCustomerById(customerId);
    if (!customer) return null;

    const ordersResult = await getOdooOrders(customerId, 1, 100);
    const orders = ordersResult.data;

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

    return {
      customerId,
      name: customer.contact_name,
      email: customer.email,
      priceListId: customer.pricebook_id || '',
      priceListName: customer.pricebook_name || '',
      totalOrders,
      totalSpent,
      averageOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      lastOrderDate: orders.length > 0 ? orders[0].date : null,
      outstandingBalance: customer.outstanding_receivable_amount || 0,
      preferredCategories: [],
      topProducts: [],
    };
  } catch (error) {
    console.error('Failed to get customer context:', error);
    return null;
  }
}

export async function getCustomerOrders(customerId: string, limit = 10): Promise<OrderInfo[]> {
  try {
    const result = await getOdooOrders(customerId, 1, limit);
    return result.data.map(o => ({
      salesorder_id: o.salesorder_id,
      salesorder_number: o.salesorder_number,
      date: o.date,
      total: o.total,
      status: o.status,
      line_items: o.line_items.map(l => ({
        item_id: l.item_id,
        name: l.name || l.item_name || '',
        quantity: l.quantity,
        rate: l.rate,
        total: l.item_total,
      })),
    }));
  } catch (error) {
    console.error('Failed to get customer orders:', error);
    return [];
  }
}

export async function getOrderStatus(orderId: string): Promise<OrderInfo | null> {
  // Not directly available without customerId
  return null;
}

export async function getCustomerInvoices(customerId: string, status?: string): Promise<InvoiceInfo[]> {
  try {
    const result = await getOdooInvoices(customerId, 1, 50);
    let invoices = result.data;
    if (status) invoices = invoices.filter(i => i.status === status);
    return invoices.map(i => ({
      invoice_id: i.invoice_id,
      invoice_number: i.invoice_number,
      date: i.date,
      due_date: i.due_date,
      total: i.total,
      balance: i.balance,
      status: i.status,
    }));
  } catch (error) {
    console.error('Failed to get customer invoices:', error);
    return [];
  }
}

export async function getReorderSuggestions(customerId: string): Promise<Array<{ item_id: string; name: string; lastOrdered: string }>> {
  return [];
}

export async function getFrequentlyBoughtTogether(itemId: string, customerId?: string): Promise<Array<{ item_id: string; name: string; frequency: number }>> {
  return [];
}

export async function getLowStockAlerts(customerId: string, threshold = 10): Promise<Array<{ item_id: string; name: string; stock: number; orderCount: number }>> {
  return [];
}
