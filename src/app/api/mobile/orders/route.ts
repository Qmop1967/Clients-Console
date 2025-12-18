// ============================================
// Mobile Orders List API
// GET /api/mobile/orders
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getCustomerOrders } from '@/lib/zoho/orders';

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

    // Fetch orders
    const ordersData = await getCustomerOrders(user.zohoContactId, page, perPage);

    if (!ordersData) {
      return mobileError(
        'FETCH_FAILED',
        'Failed to load orders',
        'فشل تحميل الطلبات',
        500
      );
    }

    let orders = ordersData.data || [];

    // Filter by status if provided
    if (status) {
      orders = orders.filter((o: { status: string }) => o.status === status);
    }

    // Transform orders for mobile
    const transformedOrders = orders.map((order: { salesorder_id: string; salesorder_number: string; reference_number?: string; date: string; status: string; total: number; currency_code?: string; line_items?: unknown[] }) => ({
      id: order.salesorder_id,
      number: order.salesorder_number,
      reference: order.reference_number || null,
      date: order.date,
      status: order.status,
      total: order.total,
      currency: order.currency_code || user.currencyCode,
      items_count: order.line_items?.length || 0,
    }));

    return mobileSuccess({
      orders: transformedOrders,
      currency: user.currencyCode,
    }, {
      page: ordersData.page_context?.page || page,
      per_page: ordersData.page_context?.per_page || perPage,
      total_items: ordersData.page_context?.total || orders.length,
      total_pages: ordersData.page_context?.total_pages || 1,
      has_more: ordersData.page_context?.has_more_page || false,
    });

  } catch (error) {
    console.error('[Mobile Orders] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load orders',
      'فشل تحميل الطلبات',
      500
    );
  }
}
