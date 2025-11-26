// ============================================
// Zoho Sales Orders API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoSalesOrder, PaginatedResponse } from '@/types';

interface ZohoOrdersResponse {
  salesorders: ZohoSalesOrder[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

interface ZohoOrderResponse {
  salesorder: ZohoSalesOrder;
}

// Get customer orders (cached per customer)
export async function getCustomerOrders(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<ZohoSalesOrder>> {
  const getCachedOrders = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoOrdersResponse>('/salesorders', {
            params: {
              customer_id: customerId,
              page,
              per_page: perPage,
              sort_column: 'date',
              sort_order: 'D',
            },
          })
        );

        return {
          data: data.salesorders || [],
          page_context: data.page_context,
        };
      } catch (error) {
        console.error('Error fetching customer orders:', error);
        return {
          data: [],
          page_context: {
            page: 1,
            per_page: perPage,
            has_more_page: false,
            total: 0,
            total_pages: 0,
          },
        };
      }
    },
    [`orders-${customerId}-${page}`],
    {
      revalidate: 120, // 2 minutes
      tags: [CACHE_TAGS.ORDERS(customerId)],
    }
  );

  return getCachedOrders();
}

// Get single order by ID
export async function getOrder(
  orderId: string,
  customerId: string
): Promise<ZohoSalesOrder | null> {
  const getCachedOrder = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoOrderResponse>(`/salesorders/${orderId}`)
        );

        return data.salesorder || null;
      } catch (error) {
        console.error('Error fetching order:', error);
        return null;
      }
    },
    [`order-${orderId}`],
    {
      revalidate: 120,
      tags: [CACHE_TAGS.ORDERS(customerId)],
    }
  );

  return getCachedOrder();
}

// Get recent orders for dashboard
export async function getRecentOrders(
  customerId: string,
  limit = 5
): Promise<ZohoSalesOrder[]> {
  const orders = await getCustomerOrders(customerId, 1, limit);
  return orders.data;
}

// Get order counts by status
export async function getOrderStats(
  customerId: string
): Promise<{
  total: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
}> {
  try {
    // Get all orders (first 100 for stats)
    const orders = await getCustomerOrders(customerId, 1, 100);

    const stats = {
      total: orders.page_context.total,
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
    };

    orders.data.forEach((order) => {
      const status = order.status?.toLowerCase();
      if (status === 'draft' || status === 'pending') stats.pending++;
      else if (status === 'confirmed') stats.confirmed++;
      else if (status === 'shipped') stats.shipped++;
      else if (status === 'delivered') stats.delivered++;
    });

    return stats;
  } catch (error) {
    console.error('Error calculating order stats:', error);
    return {
      total: 0,
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
    };
  }
}

// Create sales order (write operation - direct to Zoho)
export async function createSalesOrder(data: {
  customer_id: string;
  line_items: Array<{
    item_id: string;
    quantity: number;
    rate: number;
  }>;
  notes?: string;
  reference_number?: string;
}): Promise<ZohoSalesOrder | null> {
  try {
    const response = await rateLimitedFetch(() =>
      zohoFetch<ZohoOrderResponse>('/salesorders', {
        method: 'POST',
        body: {
          customer_id: data.customer_id,
          line_items: data.line_items,
          notes: data.notes,
          reference_number: data.reference_number,
        },
      })
    );

    return response.salesorder;
  } catch (error) {
    console.error('Error creating sales order:', error);
    return null;
  }
}

// Order status mapping
export const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  pending: { label: 'Pending', color: 'yellow' },
  confirmed: { label: 'Confirmed', color: 'blue' },
  packed: { label: 'Packed', color: 'purple' },
  shipped: { label: 'Shipped', color: 'indigo' },
  delivered: { label: 'Delivered', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
};
