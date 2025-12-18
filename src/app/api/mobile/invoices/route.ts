// ============================================
// Mobile Invoices List API
// GET /api/mobile/invoices
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getCustomerInvoices } from '@/lib/zoho/invoices';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireMobileAuth(request);
    if (isAuthError(authResult)) {
      return authResult;
    }

    const auth = authResult;
    const user = auth.user!;

    if (!user.zohoContactId) {
      return mobileError(
        'NO_CUSTOMER',
        'Your account is not linked to a customer record.',
        'حسابك غير مرتبط بسجل عميل.',
        400
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '25', 10), 50);
    const status = searchParams.get('status') || '';

    // Fetch invoices
    const invoicesData = await getCustomerInvoices(user.zohoContactId, page, perPage);

    if (!invoicesData) {
      return mobileError(
        'FETCH_FAILED',
        'Failed to load invoices',
        'فشل تحميل الفواتير',
        500
      );
    }

    let invoices = invoicesData.data || [];

    // Filter by status if provided
    if (status) {
      invoices = invoices.filter((i: { status: string }) => i.status === status);
    }

    // Transform invoices for mobile
    const transformedInvoices = invoices.map((invoice: { invoice_id: string; invoice_number: string; date: string; due_date: string; status: string; total: number; balance?: number; currency_code?: string }) => ({
      id: invoice.invoice_id,
      number: invoice.invoice_number,
      date: invoice.date,
      due_date: invoice.due_date,
      status: invoice.status,
      total: invoice.total,
      balance: invoice.balance || 0,
      currency: invoice.currency_code || user.currencyCode,
      is_overdue: invoice.status === 'overdue',
    }));

    return mobileSuccess({
      invoices: transformedInvoices,
      currency: user.currencyCode,
    }, {
      page: invoicesData.page_context?.page || page,
      per_page: invoicesData.page_context?.per_page || perPage,
      total_items: invoicesData.page_context?.total || invoices.length,
      total_pages: invoicesData.page_context?.total_pages || 1,
      has_more: invoicesData.page_context?.has_more_page || false,
    });

  } catch (error) {
    console.error('[Mobile Invoices] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load invoices',
      'فشل تحميل الفواتير',
      500
    );
  }
}
