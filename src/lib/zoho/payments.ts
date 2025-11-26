// ============================================
// Zoho Payments API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoPayment, PaginatedResponse } from '@/types';

interface ZohoPaymentsResponse {
  customerpayments: ZohoPayment[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

interface ZohoPaymentResponse {
  payment: ZohoPayment;
}

// Get customer payments (cached per customer)
export async function getCustomerPayments(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<ZohoPayment>> {
  const getCachedPayments = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoPaymentsResponse>('/customerpayments', {
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
          data: data.customerpayments || [],
          page_context: data.page_context,
        };
      } catch (error) {
        console.error('Error fetching customer payments:', error);
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
    [`payments-${customerId}-${page}`],
    {
      revalidate: 120, // 2 minutes
      tags: [CACHE_TAGS.PAYMENTS(customerId)],
    }
  );

  return getCachedPayments();
}

// Get single payment by ID
export async function getPayment(
  paymentId: string,
  customerId: string
): Promise<ZohoPayment | null> {
  const getCachedPayment = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoPaymentResponse>(`/customerpayments/${paymentId}`)
        );

        return data.payment || null;
      } catch (error) {
        console.error('Error fetching payment:', error);
        return null;
      }
    },
    [`payment-${paymentId}`],
    {
      revalidate: 120,
      tags: [CACHE_TAGS.PAYMENTS(customerId)],
    }
  );

  return getCachedPayment();
}

// Get recent payments for dashboard
export async function getRecentPayments(
  customerId: string,
  limit = 5
): Promise<ZohoPayment[]> {
  const payments = await getCustomerPayments(customerId, 1, limit);
  return payments.data;
}

// Get total payments in date range
export async function getPaymentTotals(
  customerId: string,
  fromDate?: string,
  toDate?: string
): Promise<{ total: number; count: number }> {
  const getCachedTotals = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoPaymentsResponse>('/customerpayments', {
            params: {
              customer_id: customerId,
              per_page: 200,
              ...(fromDate && { date_start: fromDate }),
              ...(toDate && { date_end: toDate }),
            },
          })
        );

        const payments = data.customerpayments || [];
        const total = payments.reduce((sum, p) => sum + p.amount, 0);

        return { total, count: payments.length };
      } catch (error) {
        console.error('Error calculating payment totals:', error);
        return { total: 0, count: 0 };
      }
    },
    [`payment-totals-${customerId}-${fromDate}-${toDate}`],
    {
      revalidate: 300,
      tags: [CACHE_TAGS.PAYMENTS(customerId)],
    }
  );

  return getCachedTotals();
}
