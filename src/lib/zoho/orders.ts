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
// Uses Zoho Books API for better performance and higher rate limits
export async function getOrder(
  orderId: string,
  customerId: string
): Promise<ZohoSalesOrder | null> {
  const getCachedOrder = unstable_cache(
    async () => {
      try {
        console.log(`[getOrder] Fetching order ${orderId} for customer ${customerId}`);
        // Use Books API (default) for better performance and rate limits
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoOrderResponse>(`/salesorders/${orderId}`)
        );

        if (!data.salesorder) {
          console.warn(`[getOrder] Order ${orderId} not found in Zoho response`);
          return null;
        }

        // Verify the order belongs to the customer for security
        if (data.salesorder.customer_id !== customerId) {
          console.warn(`[getOrder] Order ${orderId} does not belong to customer ${customerId}`);
          return null;
        }

        console.log(`[getOrder] Order ${orderId}: status=${data.salesorder.status}, total=${data.salesorder.total}`);
        return data.salesorder;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[getOrder] Error fetching order ${orderId}:`, errorMessage);

        // Check if it's a 404 (order not found) vs timeout/other error
        if (errorMessage.includes('404')) {
          console.warn(`[getOrder] Order ${orderId} not found (404)`);
          return null;
        }

        // For timeouts or other errors, also return null but log as error
        console.error(`[getOrder] Failed to fetch order ${orderId} due to: ${errorMessage}`);
        return null;
      }
    },
    [`order-${orderId}-v3`], // Changed cache key to invalidate old cached data
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
// Note: We fetch order from Books API, then get packages/shipments from Inventory API
export async function getOrderWithDetails(
  orderId: string,
  customerId: string
): Promise<{
  order: ZohoSalesOrder | null;
  packages: ZohoPackage[];
  shipments: ZohoShipment[];
}> {
  // Fetch order, packages, and shipments in parallel for better performance
  const [order, packages, shipments] = await Promise.all([
    getOrder(orderId, customerId),
    getOrderPackages(orderId, customerId),
    getOrderShipments(orderId, customerId),
  ]);

  if (!order) {
    return { order: null, packages: [], shipments: [] };
  }

  // If no explicit shipments but packages have carrier info, derive shipments from packages
  let finalShipments = shipments;

  // If no shipments in response but packages have carrier info, create shipment entries from packages
  if (finalShipments.length === 0 && packages.length > 0) {
    // Check if any package has been shipped (has carrier info)
    const shippedPackages = packages.filter(pkg => pkg.carrier || pkg.tracking_number || pkg.status?.toLowerCase() === 'delivered');

    if (shippedPackages.length > 0) {
      // Create shipment entries from shipped packages
      finalShipments = shippedPackages.map((pkg) => ({
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

  console.log(`[getOrderWithDetails] Order ${orderId}: ${packages.length} packages, ${finalShipments.length} shipments`);

  return { order, packages, shipments: finalShipments };
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

// Location configuration for order creation
// Main TSH Business: Business location for tax/reporting (order level)
// Main WareHouse: Physical warehouse for stock fulfillment (line item level)
const MAIN_TSH_BUSINESS_ID = '2646610000001123033';
const MAIN_WAREHOUSE_ID = '2646610000000077024';

// Order creation result type - includes error details when failed
export interface CreateOrderResult {
  success: boolean;
  order?: ZohoSalesOrder;
  error?: string;
  errorCode?: string;
}

// Create sales order (write operation - direct to Zoho Inventory API)
// Sets location_id at order level (business location) and on each line item (warehouse)
export async function createSalesOrder(data: {
  customer_id: string;
  line_items: Array<{
    item_id: string;
    quantity: number;
    rate: number;
  }>;
  notes?: string;
  reference_number?: string;
}): Promise<CreateOrderResult> {
  try {
    // Add location_id to each line item - this specifies the warehouse for stock fulfillment
    const lineItemsWithWarehouse = data.line_items.map(item => ({
      ...item,
      location_id: MAIN_WAREHOUSE_ID,
    }));

    const orderBody = {
      customer_id: data.customer_id,
      // Business location at order level (for tax/reporting)
      location_id: MAIN_TSH_BUSINESS_ID,
      // Line items with warehouse location for stock allocation
      line_items: lineItemsWithWarehouse,
      notes: data.notes,
      reference_number: data.reference_number,
    };

    console.log(`[createSalesOrder] Creating order for customer ${data.customer_id} with ${data.line_items.length} items`);
    console.log(`[createSalesOrder] Request body:`, JSON.stringify(orderBody, null, 2));

    const response = await rateLimitedFetch(() =>
      zohoFetch<ZohoOrderResponse>('/salesorders', {
        method: 'POST',
        api: 'books', // Use Books API for higher rate limits and lower cost
        body: orderBody,
      })
    );

    console.log(`[createSalesOrder] Success! Order: ${response.salesorder?.salesorder_number}`);
    return { success: true, order: response.salesorder };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[createSalesOrder] Failed to create order:', errorMessage);

    // Parse Zoho error code if available
    let errorCode: string | undefined;
    let userFriendlyError = errorMessage;

    // Try to extract Zoho error details
    try {
      const zohoErrorMatch = errorMessage.match(/Zoho API error \(\d+\): (.+)/);
      if (zohoErrorMatch) {
        const zohoResponse = JSON.parse(zohoErrorMatch[1]);
        errorCode = zohoResponse.code?.toString();
        userFriendlyError = zohoResponse.message || errorMessage;
      }
    } catch {
      // Keep original error message
    }

    return { success: false, error: userFriendlyError, errorCode };
  }
}

// Confirm a sales order (uses Books API to match order creation)
export async function confirmSalesOrder(salesorderId: string): Promise<boolean> {
  try {
    await rateLimitedFetch(() =>
      zohoFetch<{ message: string }>(`/salesorders/${salesorderId}/status/confirmed`, {
        method: 'POST',
        api: 'books', // Use Books API for higher rate limits and lower cost
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

// ============================================
// Receipt Tracking Functions
// ============================================

export interface ReceiptEvent {
  timestamp: string;
  quantity: number;
  totalReceived: number;
  receivedBy?: string;
}

// Update line item receipt status
export async function updateLineItemReceipt(
  orderId: string,
  lineItemId: string,
  quantityReceived: number,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First get the current order to access line items
    const order = await getOrder(orderId, customerId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Find the line item
    const lineItem = order.line_items.find(item => item.line_item_id === lineItemId);
    if (!lineItem) {
      return { success: false, error: 'Line item not found' };
    }

    // Calculate new totals
    const currentReceived = lineItem.cf_quantity_received || 0;
    const newTotalReceived = currentReceived + quantityReceived;
    const quantityOrdered = lineItem.quantity;

    // Determine new status
    let newStatus: 'pending' | 'partial' | 'completed' = 'pending';
    if (newTotalReceived >= quantityOrdered) {
      newStatus = 'completed';
    } else if (newTotalReceived > 0) {
      newStatus = 'partial';
    }

    // Get existing timeline or create new
    let timeline: ReceiptEvent[] = [];
    if (order.cf_receive_timeline) {
      try {
        timeline = JSON.parse(order.cf_receive_timeline);
      } catch {
        timeline = [];
      }
    }

    // Add new event to timeline
    const newEvent: ReceiptEvent = {
      timestamp: new Date().toISOString(),
      quantity: quantityReceived,
      totalReceived: newTotalReceived,
    };
    timeline.push(newEvent);

    // Update the sales order with new custom field values
    // Note: Zoho Books API doesn't support updating individual line item custom fields directly
    // We need to update the entire order with modified line items
    const updatedLineItems = order.line_items.map(item => {
      if (item.line_item_id === lineItemId) {
        return {
          ...item,
          cf_quantity_received: newTotalReceived,
          cf_receive_status: newStatus,
          cf_last_received_date: new Date().toISOString().split('T')[0],
        };
      }
      return item;
    });

    // Calculate overall order receive status
    const allItemsReceived = updatedLineItems.every(
      item => (item.cf_quantity_received || 0) >= item.quantity
    );
    const someItemsReceived = updatedLineItems.some(
      item => (item.cf_quantity_received || 0) > 0
    );

    const overallStatus: 'pending' | 'partial' | 'completed' = allItemsReceived
      ? 'completed'
      : someItemsReceived
      ? 'partial'
      : 'pending';

    // Update the order via Zoho API
    await rateLimitedFetch(() =>
      zohoFetch(`/salesorders/${orderId}`, {
        method: 'PUT',
        api: 'books', // Use Books API for higher rate limits and lower cost
        body: {
          line_items: updatedLineItems,
          cf_overall_receive_status: overallStatus,
          cf_receive_timeline: JSON.stringify(timeline),
        },
      })
    );

    console.log(`[updateLineItemReceipt] Updated item ${lineItemId} in order ${orderId}: ${newTotalReceived}/${quantityOrdered} (${newStatus})`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[updateLineItemReceipt] Failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Get receipt timeline for an order
export async function getReceiptTimeline(
  orderId: string,
  customerId: string
): Promise<ReceiptEvent[]> {
  try {
    const order = await getOrder(orderId, customerId);
    if (!order || !order.cf_receive_timeline) {
      return [];
    }

    return JSON.parse(order.cf_receive_timeline);
  } catch (error) {
    console.error('[getReceiptTimeline] Failed to parse timeline:', error);
    return [];
  }
}
