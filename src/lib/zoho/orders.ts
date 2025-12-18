// ============================================
// Zoho Sales Orders API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoSalesOrder, ZohoPackage, ZohoShipment, PaginatedResponse } from '@/types';

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

interface ZohoPackagesResponse {
  packages: ZohoPackage[];
}

interface ZohoShipmentsResponse {
  shipmentorders: ZohoShipment[];
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
// Uses Zoho Inventory API to get order details with packages/shipments included
export async function getOrder(
  orderId: string,
  customerId: string
): Promise<ZohoSalesOrder | null> {
  const getCachedOrder = unstable_cache(
    async () => {
      try {
        // Use Inventory API to get order with packages/shipments included
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoOrderResponse>(`/salesorders/${orderId}`, {
            api: 'inventory',
          })
        );

        console.log(`[getOrder] Order ${orderId}: packages=${data.salesorder?.packages?.length || 0}, shipments=${data.salesorder?.shipments?.length || 0}`);
        return data.salesorder || null;
      } catch (error) {
        console.error('Error fetching order:', error);
        return null;
      }
    },
    [`order-${orderId}-v2`], // Changed cache key to invalidate old cached data
    {
      revalidate: 120,
      tags: [CACHE_TAGS.ORDERS(customerId)],
    }
  );

  return getCachedOrder();
}

// Get packages for a sales order
export async function getOrderPackages(
  orderId: string,
  customerId: string
): Promise<ZohoPackage[]> {
  const getCachedPackages = unstable_cache(
    async () => {
      try {
        // Use Zoho Inventory API for packages (not Books)
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoPackagesResponse>(`/packages`, {
            api: 'inventory',
            params: {
              salesorder_id: orderId,
            },
          })
        );

        console.log(`[getOrderPackages] Order ${orderId}: Found ${data.packages?.length || 0} packages`);
        return data.packages || [];
      } catch (error) {
        console.error('Error fetching packages:', error);
        return [];
      }
    },
    [`packages-${orderId}`],
    {
      revalidate: 120,
      tags: [CACHE_TAGS.ORDERS(customerId)],
    }
  );

  return getCachedPackages();
}

// Get shipments for a sales order
export async function getOrderShipments(
  orderId: string,
  customerId: string
): Promise<ZohoShipment[]> {
  const getCachedShipments = unstable_cache(
    async () => {
      try {
        // Use Zoho Inventory API for shipments (not Books)
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoShipmentsResponse>(`/shipmentorders`, {
            api: 'inventory',
            params: {
              salesorder_id: orderId,
            },
          })
        );

        console.log(`[getOrderShipments] Order ${orderId}: Found ${data.shipmentorders?.length || 0} shipments`);
        return data.shipmentorders || [];
      } catch (error) {
        console.error('Error fetching shipments:', error);
        return [];
      }
    },
    [`shipments-${orderId}`],
    {
      revalidate: 120,
      tags: [CACHE_TAGS.ORDERS(customerId)],
    }
  );

  return getCachedShipments();
}

// Get full order details with packages and shipments
// Note: We get packages from the Inventory API order response
// Shipments are derived from packages (each package with carrier = shipment)
export async function getOrderWithDetails(
  orderId: string,
  customerId: string
): Promise<{
  order: ZohoSalesOrder | null;
  packages: ZohoPackage[];
  shipments: ZohoShipment[];
}> {
  // First get the order details from Inventory API
  const order = await getOrder(orderId, customerId);

  if (!order) {
    return { order: null, packages: [], shipments: [] };
  }

  // Get packages from the order response
  const packages = order.packages || [];

  // Get shipments from the order response, or derive from packages
  let shipments = order.shipments || [];

  // If no shipments in response but packages have carrier info, create shipment entries from packages
  if (shipments.length === 0 && packages.length > 0) {
    // Check if any package has been shipped (has carrier info)
    const shippedPackages = packages.filter(pkg => pkg.carrier || pkg.tracking_number || pkg.status?.toLowerCase() === 'delivered');

    if (shippedPackages.length > 0) {
      // Create shipment entries from shipped packages
      shipments = shippedPackages.map((pkg) => ({
        shipment_id: `ship-${pkg.package_id}`,
        shipment_number: `SHP-${pkg.package_number}`,
        salesorder_id: orderId,
        package_ids: [pkg.package_id],
        date: pkg.date,
        carrier: pkg.carrier || '',
        tracking_number: pkg.tracking_number,
        status: pkg.status || 'shipped',
        created_time: pkg.created_time,
        last_modified_time: pkg.last_modified_time,
      }));
    }
  }

  console.log(`[getOrderWithDetails] Order ${orderId}: ${packages.length} packages, ${shipments.length} shipments`);

  return { order, packages, shipments };
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

    // Debug logging
    console.log(`[getOrderStats] Customer ${customerId}: Total orders from API = ${orders.page_context?.total}, Data count = ${orders.data?.length}`);

    const stats = {
      total: orders.page_context?.total ?? 0,
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

// Main WareHouse ID - all orders should fulfill from this warehouse
const MAIN_WAREHOUSE_ID = '2646610000000077024';

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
    // Add warehouse_id to each line item to ensure stock is taken from Main WareHouse
    const lineItemsWithWarehouse = data.line_items.map(item => ({
      ...item,
      warehouse_id: MAIN_WAREHOUSE_ID,
    }));

    const response = await rateLimitedFetch(() =>
      zohoFetch<ZohoOrderResponse>('/salesorders', {
        method: 'POST',
        body: {
          customer_id: data.customer_id,
          line_items: lineItemsWithWarehouse,
          notes: data.notes,
          reference_number: data.reference_number,
        },
      })
    );

    console.log(`[createSalesOrder] Created order with warehouse_id: ${MAIN_WAREHOUSE_ID} (Main WareHouse)`);
    return response.salesorder;
  } catch (error) {
    console.error('Error creating sales order:', error);
    return null;
  }
}

// Confirm a sales order
export async function confirmSalesOrder(salesorderId: string): Promise<boolean> {
  try {
    await rateLimitedFetch(() =>
      zohoFetch<{ message: string }>(`/salesorders/${salesorderId}/status/confirmed`, {
        method: 'POST',
      })
    );
    console.log(`[confirmSalesOrder] Order ${salesorderId} confirmed successfully`);
    return true;
  } catch (error) {
    console.error('Error confirming sales order:', error);
    return false;
  }
}

// Create invoice from sales order
interface ZohoInvoiceResponse {
  invoice: {
    invoice_id: string;
    invoice_number: string;
    status: string;
    total: number;
    balance: number;
    date: string;
    due_date: string;
  };
}

export async function createInvoiceFromSalesOrder(salesorderId: string): Promise<ZohoInvoiceResponse['invoice'] | null> {
  try {
    const response = await rateLimitedFetch(() =>
      zohoFetch<ZohoInvoiceResponse>('/invoices/fromsalesorder', {
        method: 'POST',
        params: {
          salesorder_id: salesorderId,
        },
      })
    );
    console.log(`[createInvoiceFromSalesOrder] Invoice ${response.invoice?.invoice_number} created for order ${salesorderId}`);
    return response.invoice;
  } catch (error) {
    console.error('Error creating invoice from sales order:', error);
    return null;
  }
}

// Confirm an invoice (mark as sent)
export async function confirmInvoice(invoiceId: string): Promise<boolean> {
  try {
    await rateLimitedFetch(() =>
      zohoFetch<{ message: string }>(`/invoices/${invoiceId}/status/sent`, {
        method: 'POST',
      })
    );
    console.log(`[confirmInvoice] Invoice ${invoiceId} marked as sent`);
    return true;
  } catch (error) {
    console.error('Error confirming invoice:', error);
    return false;
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

// Summary stats interface
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

// Get comprehensive order summary stats (OPTIMIZED: uses parallel status-filtered requests)
// Instead of fetching ALL orders (potentially 1000s), we fetch count+total per status filter
// This reduces API calls from 1-20 to just 5-6 parallel requests
export async function getOrderSummaryStats(customerId: string): Promise<OrderSummaryStats> {
  const getCachedStats = unstable_cache(
    async () => {
      try {
        // Status filters to query
        const statusFilters = [
          { filter: 'Status.All', key: 'all' },
          { filter: 'Status.Draft', key: 'draft' },
          { filter: 'Status.Open', key: 'open' },
          { filter: 'Status.Invoiced', key: 'invoiced' },
          { filter: 'Status.Void', key: 'void' },
          { filter: 'Status.Closed', key: 'closed' },
        ];

        // Fetch counts in parallel (much faster than fetching all records)
        const results = await Promise.all(
          statusFilters.map(async ({ filter, key }) => {
            try {
              const data = await rateLimitedFetch(() =>
                zohoFetch<ZohoOrdersResponse>('/salesorders', {
                  params: {
                    customer_id: customerId,
                    filter_by: filter,
                    page: 1,
                    per_page: 1, // Only need count from page_context
                    response_option: 1, // Returns count + totals
                  },
                })
              );

              return {
                key,
                count: data.page_context?.total || 0,
                // Note: Zoho doesn't return sum in page_context, so we estimate
                // For accurate totals, we'd need to fetch more records
              };
            } catch (error) {
              console.error(`Error fetching ${key} orders:`, error);
              return { key, count: 0 };
            }
          })
        );

        // Build stats from results
        const statsMap = new Map(results.map(r => [r.key, r.count]));

        const stats: OrderSummaryStats = {
          totalOrders: statsMap.get('all') || 0,
          totalAmount: 0, // Would need additional API calls for accurate total
          pendingCount: statsMap.get('draft') || 0,
          pendingAmount: 0,
          confirmedCount: statsMap.get('open') || 0,
          confirmedAmount: 0,
          shippedCount: 0, // Zoho doesn't have shipped filter
          shippedAmount: 0,
          deliveredCount: statsMap.get('closed') || 0,
          deliveredAmount: 0,
          invoicedCount: statsMap.get('invoiced') || 0,
          invoicedAmount: 0,
          cancelledCount: statsMap.get('void') || 0,
        };

        console.log(`[getOrderSummaryStats] Customer ${customerId}: ${stats.totalOrders} total orders`);

        return stats;
      } catch (error) {
        console.error('Error calculating order summary stats:', error);
        return {
          totalOrders: 0,
          totalAmount: 0,
          pendingCount: 0,
          pendingAmount: 0,
          confirmedCount: 0,
          confirmedAmount: 0,
          shippedCount: 0,
          shippedAmount: 0,
          deliveredCount: 0,
          deliveredAmount: 0,
          invoicedCount: 0,
          invoicedAmount: 0,
          cancelledCount: 0,
        };
      }
    },
    [`order-summary-stats-${customerId}-v2`], // Changed cache key for new implementation
    {
      revalidate: 300, // 5 minutes
      tags: [CACHE_TAGS.ORDERS(customerId)],
    }
  );

  return getCachedStats();
}
