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
