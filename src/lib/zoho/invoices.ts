// ============================================
// Zoho Invoices API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoInvoice, PaginatedResponse } from '@/types';

interface ZohoInvoicesResponse {
  invoices: ZohoInvoice[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

interface ZohoInvoiceResponse {
  invoice: ZohoInvoice;
}

// Get customer invoices (cached per customer)
export async function getCustomerInvoices(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<ZohoInvoice>> {
  const getCachedInvoices = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoInvoicesResponse>('/invoices', {
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
          data: data.invoices || [],
          page_context: data.page_context,
        };
      } catch (error) {
        console.error('Error fetching customer invoices:', error);
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
    [`invoices-${customerId}-${page}`],
    {
      revalidate: 120, // 2 minutes
      tags: [CACHE_TAGS.INVOICES(customerId)],
    }
  );

  return getCachedInvoices();
}

// Get single invoice by ID
export async function getInvoice(
  invoiceId: string,
  customerId: string
): Promise<ZohoInvoice | null> {
  const getCachedInvoice = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoInvoiceResponse>(`/invoices/${invoiceId}`)
        );

        return data.invoice || null;
      } catch (error) {
        console.error('Error fetching invoice:', error);
        return null;
      }
    },
    [`invoice-${invoiceId}`],
    {
      revalidate: 120,
      tags: [CACHE_TAGS.INVOICES(customerId)],
    }
  );

  return getCachedInvoice();
}

// Get recent invoices for dashboard
export async function getRecentInvoices(
  customerId: string,
  limit = 5
): Promise<ZohoInvoice[]> {
  const invoices = await getCustomerInvoices(customerId, 1, limit);
  return invoices.data;
}

// Get overdue invoices
export async function getOverdueInvoices(
  customerId: string
): Promise<ZohoInvoice[]> {
  const getCachedOverdue = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoInvoicesResponse>('/invoices', {
            params: {
              customer_id: customerId,
              status: 'overdue',
              per_page: 50,
            },
          })
        );

        return data.invoices || [];
      } catch (error) {
        console.error('Error fetching overdue invoices:', error);
        return [];
      }
    },
    [`invoices-overdue-${customerId}`],
    {
      revalidate: 300,
      tags: [CACHE_TAGS.INVOICES(customerId)],
    }
  );

  return getCachedOverdue();
}

// Invoice status mapping
export const INVOICE_STATUS_MAP: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'gray' },
  sent: { label: 'Sent', color: 'blue' },
  viewed: { label: 'Viewed', color: 'purple' },
  overdue: { label: 'Overdue', color: 'red' },
  partially_paid: { label: 'Partially Paid', color: 'yellow' },
  paid: { label: 'Paid', color: 'green' },
  void: { label: 'Void', color: 'gray' },
};

// Invoice summary stats interface
export interface InvoiceSummaryStats {
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  overdueAmount: number;
  overdueCount: number;
  pendingAmount: number;
  pendingCount: number;
  paidCount: number;
  totalCount: number;
}

// Get invoice summary stats for customer (OPTIMIZED: uses parallel status-filtered requests)
// Instead of fetching ALL invoices (potentially 1000s), we use status filters + response_option
// This reduces API calls from 1-10 to just 4-5 parallel requests
export async function getInvoiceSummaryStats(
  customerId: string
): Promise<InvoiceSummaryStats> {
  const getCachedStats = unstable_cache(
    async () => {
      try {
        // Status filters to query - Zoho invoice statuses
        const statusFilters = [
          { status: undefined, filter: 'Status.All', key: 'all' },
          { status: 'paid', filter: undefined, key: 'paid' },
          { status: 'overdue', filter: undefined, key: 'overdue' },
          { status: 'unpaid', filter: undefined, key: 'unpaid' },
        ];

        // Fetch counts in parallel using response_option=1 for count+totals
        const results = await Promise.all(
          statusFilters.map(async ({ status, filter, key }) => {
            try {
              const params: Record<string, string | number | boolean> = {
                customer_id: customerId,
                page: 1,
                per_page: 1, // Only need count from page_context
                response_option: 1, // Returns count + totals
              };

              if (status) params.status = status;
              if (filter) params.filter_by = filter;

              const data = await rateLimitedFetch(() =>
                zohoFetch<ZohoInvoicesResponse>('/invoices', { params })
              );

              return {
                key,
                count: data.page_context?.total || 0,
              };
            } catch (error) {
              console.error(`Error fetching ${key} invoices:`, error);
              return { key, count: 0 };
            }
          })
        );

        // Build stats from results
        const statsMap = new Map(results.map(r => [r.key, r.count]));

        const totalCount = statsMap.get('all') || 0;
        const paidCount = statsMap.get('paid') || 0;
        const overdueCount = statsMap.get('overdue') || 0;
        const unpaidCount = statsMap.get('unpaid') || 0;

        // Pending = unpaid - overdue (those not yet overdue)
        const pendingCount = Math.max(0, unpaidCount - overdueCount);

        const stats: InvoiceSummaryStats = {
          totalAmount: 0, // Would need additional API calls for accurate amounts
          paidAmount: 0,
          balanceAmount: 0,
          overdueAmount: 0,
          overdueCount,
          pendingAmount: 0,
          pendingCount,
          paidCount,
          totalCount,
        };

        console.log(`[getInvoiceSummaryStats] Customer ${customerId}: ${totalCount} total, ${paidCount} paid, ${overdueCount} overdue`);

        return stats;
      } catch (error) {
        console.error('Error fetching invoice summary stats:', error);
        return {
          totalAmount: 0,
          paidAmount: 0,
          balanceAmount: 0,
          overdueAmount: 0,
          overdueCount: 0,
          pendingAmount: 0,
          pendingCount: 0,
          paidCount: 0,
          totalCount: 0,
        };
      }
    },
    [`invoices-summary-${customerId}-v2`], // Changed cache key for new implementation
    {
      revalidate: 300, // 5 minutes cache for summary
      tags: [CACHE_TAGS.INVOICES(customerId)],
    }
  );

  return getCachedStats();
}
