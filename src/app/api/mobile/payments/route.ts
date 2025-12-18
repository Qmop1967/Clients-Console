// ============================================
// Mobile Payments List API
// GET /api/mobile/payments
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getCustomerPayments } from '@/lib/zoho/payments';

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

    // Fetch payments
    const paymentsData = await getCustomerPayments(user.zohoContactId, page, perPage);

    if (!paymentsData) {
      return mobileError(
        'FETCH_FAILED',
        'Failed to load payments',
        'فشل تحميل المدفوعات',
        500
      );
    }

    const payments = paymentsData.data || [];

    // Transform payments for mobile
    const transformedPayments = payments.map((payment: { payment_id: string; payment_number: string; date: string; amount: number; reference_number?: string; payment_mode?: string; currency_code?: string; invoices?: unknown[] }) => ({
      id: payment.payment_id,
      number: payment.payment_number,
      date: payment.date,
      amount: payment.amount,
      reference: payment.reference_number || null,
      mode: payment.payment_mode || null,
      currency: payment.currency_code || user.currencyCode,
      invoices_count: payment.invoices?.length || 0,
    }));

    return mobileSuccess({
      payments: transformedPayments,
      currency: user.currencyCode,
    }, {
      page: paymentsData.page_context?.page || page,
      per_page: paymentsData.page_context?.per_page || perPage,
      total_items: paymentsData.page_context?.total || payments.length,
      total_pages: paymentsData.page_context?.total_pages || 1,
      has_more: paymentsData.page_context?.has_more_page || false,
    });

  } catch (error) {
    console.error('[Mobile Payments] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load payments',
      'فشل تحميل المدفوعات',
      500
    );
  }
}
