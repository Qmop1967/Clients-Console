// ============================================
// TSH Clients Console - Customer Intelligence
// Business context and order history for AI
// ============================================

import { zohoFetch } from '@/lib/zoho/client';
import { getUnifiedStock } from '@/lib/zoho/stock-cache';

// ============================================
// Types
// ============================================

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
  topProducts: Array<{
    item_id: string;
    name: string;
    orderCount: number;
  }>;
}

export interface OrderInfo {
  salesorder_id: string;
  salesorder_number: string;
  date: string;
  total: number;
  status: string;
  delivery_date?: string;
  line_items: Array<{
    item_id: string;
    name: string;
    quantity: number;
    rate: number;
    total: number;
  }>;
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

// ============================================
// Customer Intelligence Functions
// ============================================

/**
 * Get comprehensive customer context for AI
 */
export async function getCustomerContext(
  customerId: string
): Promise<CustomerContext | null> {
  try {
    // Fetch customer details
    const customerData = await zohoFetch<any>(
      `/contacts/${customerId}?organization_id=748369814`,
      { api: 'books' }
    );

    if (!customerData.contact) {
      return null;
    }

    const contact = customerData.contact;

    // Fetch customer orders
    const ordersData = await zohoFetch<any>(
      `/salesorders?customer_id=${customerId}&organization_id=748369814`,
      { api: 'books' }
    );

    const orders = ordersData.salesorders || [];

    // Calculate metrics
    const totalOrders = orders.length;
    const totalSpent = orders.reduce(
      (sum: number, order: any) => sum + (order.total || 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastOrderDate =
      orders.length > 0 ? orders[0].date : null;

    // Analyze product preferences
    const productFrequency = new Map<string, { name: string; count: number }>();

    for (const order of orders) {
      for (const item of order.line_items || []) {
        const existing = productFrequency.get(item.item_id);
        if (existing) {
          existing.count++;
        } else {
          productFrequency.set(item.item_id, {
            name: item.name,
            count: 1,
          });
        }
      }
    }

    // Top 5 products
    const topProducts = Array.from(productFrequency.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([item_id, { name, count }]) => ({
        item_id,
        name,
        orderCount: count,
      }));

    // Extract preferred categories (from top products)
    const preferredCategories: string[] = [];
    // We'll populate this when we fetch product details

    return {
      customerId,
      name: contact.contact_name,
      email: contact.email,
      priceListId: contact.pricebook_id || '',
      priceListName: contact.pricebook_name || 'Consumer',
      totalOrders,
      totalSpent,
      averageOrderValue,
      lastOrderDate,
      outstandingBalance: contact.outstanding_receivable_amount || 0,
      creditLimit: contact.credit_limit,
      preferredCategories,
      topProducts,
    };
  } catch (error) {
    console.error('❌ Failed to get customer context:', error);
    return null;
  }
}

/**
 * Get customer order history
 */
export async function getCustomerOrders(
  customerId: string,
  limit: number = 10
): Promise<OrderInfo[]> {
  try {
    const data = await zohoFetch<any>(
      `/salesorders?customer_id=${customerId}&organization_id=748369814&sort_column=date&sort_order=D&page=1&per_page=${limit}`,
      { api: 'books' }
    );

    const orders = data.salesorders || [];

    return orders.map((order: any) => ({
      salesorder_id: order.salesorder_id,
      salesorder_number: order.salesorder_number,
      date: order.date,
      total: order.total,
      status: order.status,
      delivery_date: order.delivery_date,
      line_items: order.line_items || [],
    }));
  } catch (error) {
    console.error('❌ Failed to get customer orders:', error);
    return [];
  }
}

/**
 * Get specific order status
 */
export async function getOrderStatus(
  orderId: string
): Promise<OrderInfo | null> {
  try {
    const data = await zohoFetch<any>(
      `/salesorders/${orderId}?organization_id=748369814`,
      { api: 'books' }
    );

    if (!data.salesorder) {
      return null;
    }

    const order = data.salesorder;

    return {
      salesorder_id: order.salesorder_id,
      salesorder_number: order.salesorder_number,
      date: order.date,
      total: order.total,
      status: order.status,
      delivery_date: order.delivery_date,
      line_items: order.line_items || [],
    };
  } catch (error) {
    console.error('❌ Failed to get order status:', error);
    return null;
  }
}

/**
 * Get customer invoices
 */
export async function getCustomerInvoices(
  customerId: string,
  status?: 'paid' | 'unpaid' | 'overdue'
): Promise<InvoiceInfo[]> {
  try {
    let url = `/invoices?customer_id=${customerId}&organization_id=748369814&sort_column=date&sort_order=D`;

    if (status) {
      url += `&status=${status}`;
    }

    const data = await zohoFetch<any>(url, { api: 'books' });

    const invoices = data.invoices || [];

    return invoices.map((invoice: any) => ({
      invoice_id: invoice.invoice_id,
      invoice_number: invoice.invoice_number,
      date: invoice.date,
      due_date: invoice.due_date,
      total: invoice.total,
      balance: invoice.balance,
      status: invoice.status,
    }));
  } catch (error) {
    console.error('❌ Failed to get customer invoices:', error);
    return [];
  }
}

/**
 * Get reorder suggestions based on purchase history
 */
export async function getReorderSuggestions(
  customerId: string
): Promise<Array<{ item_id: string; name: string; lastOrdered: string }>> {
  try {
    const orders = await getCustomerOrders(customerId, 20);

    // Find items ordered in last 3 orders but not in most recent
    const recentOrders = orders.slice(0, 3);
    const olderOrders = orders.slice(3, 10);

    const recentItems = new Set(
      recentOrders.flatMap((o) => o.line_items.map((i) => i.item_id))
    );

    const olderItems = new Map<
      string,
      { name: string; lastOrdered: string }
    >();

    for (const order of olderOrders) {
      for (const item of order.line_items) {
        if (!recentItems.has(item.item_id)) {
          olderItems.set(item.item_id, {
            name: item.name,
            lastOrdered: order.date,
          });
        }
      }
    }

    return Array.from(olderItems.entries()).map(
      ([item_id, { name, lastOrdered }]) => ({
        item_id,
        name,
        lastOrdered,
      })
    );
  } catch (error) {
    console.error('❌ Failed to get reorder suggestions:', error);
    return [];
  }
}

/**
 * Get frequently bought together products
 */
export async function getFrequentlyBoughtTogether(
  itemId: string,
  customerId?: string
): Promise<Array<{ item_id: string; name: string; frequency: number }>> {
  try {
    // Get all orders containing this item
    let orders: OrderInfo[];

    if (customerId) {
      orders = await getCustomerOrders(customerId, 50);
    } else {
      // Get all recent orders (cross-customer analysis)
      const data = await zohoFetch<any>(
        `/salesorders?organization_id=748369814&sort_column=date&sort_order=D&page=1&per_page=100`,
        { api: 'books' }
      );
      orders = data.salesorders || [];
    }

    // Find orders containing the target item
    const ordersWithItem = orders.filter((order) =>
      order.line_items.some((item) => item.item_id === itemId)
    );

    // Count co-occurrences
    const coOccurrences = new Map<string, { name: string; count: number }>();

    for (const order of ordersWithItem) {
      for (const item of order.line_items) {
        if (item.item_id !== itemId) {
          const existing = coOccurrences.get(item.item_id);
          if (existing) {
            existing.count++;
          } else {
            coOccurrences.set(item.item_id, {
              name: item.name,
              count: 1,
            });
          }
        }
      }
    }

    // Sort by frequency
    return Array.from(coOccurrences.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([item_id, { name, count }]) => ({
        item_id,
        name,
        frequency: count,
      }));
  } catch (error) {
    console.error('❌ Failed to get frequently bought together:', error);
    return [];
  }
}

/**
 * Get low stock alerts for customer's frequently ordered items
 */
export async function getLowStockAlerts(
  customerId: string,
  threshold: number = 10
): Promise<
  Array<{ item_id: string; name: string; stock: number; orderCount: number }>
> {
  try {
    const context = await getCustomerContext(customerId);
    if (!context) return [];

    const alerts: Array<{
      item_id: string;
      name: string;
      stock: number;
      orderCount: number;
    }> = [];

    for (const product of context.topProducts) {
      const stockData = await getUnifiedStock(product.item_id);

      if (stockData.stock <= threshold) {
        alerts.push({
          item_id: product.item_id,
          name: product.name,
          stock: stockData.stock,
          orderCount: product.orderCount,
        });
      }
    }

    return alerts.sort((a, b) => b.orderCount - a.orderCount);
  } catch (error) {
    console.error('❌ Failed to get low stock alerts:', error);
    return [];
  }
}
