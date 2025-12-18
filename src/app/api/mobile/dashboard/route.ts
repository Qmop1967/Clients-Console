// ============================================
// Mobile Dashboard API
// GET /api/mobile/dashboard
// ============================================
// Returns customer balance, order stats, and recent activity
// Requires authentication
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getCustomerBalance } from '@/lib/zoho/customers';
import { getCustomerOrders } from '@/lib/zoho/orders';
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

    // Fetch data in parallel
    const [balanceData, ordersData, invoicesData] = await Promise.all([
      getCustomerBalance(user.zohoContactId),
      getCustomerOrders(user.zohoContactId, 1, 5), // Last 5 orders
      getCustomerInvoices(user.zohoContactId, 1, 5), // Last 5 invoices
    ]);

    // Calculate order stats
    const allOrders = ordersData?.data || [];
    const orderStats = {
      total: allOrders.length,
      pending: allOrders.filter((o: { status: string }) => o.status === 'draft' || o.status === 'pending').length,
      confirmed: allOrders.filter((o: { status: string }) => o.status === 'confirmed').length,
      shipped: allOrders.filter((o: { status: string }) => o.status === 'shipped').length,
      delivered: allOrders.filter((o: { status: string }) => o.status === 'delivered' || o.status === 'fulfilled').length,
    };

    // Transform recent orders
    const recentOrders = allOrders.slice(0, 5).map((order: { salesorder_id: string; salesorder_number: string; date: string; status: string; total: number }) => ({
      id: order.salesorder_id,
      number: order.salesorder_number,
      date: order.date,
      status: order.status,
      total: order.total,
    }));

    // Transform recent invoices
    const invoicesArray = invoicesData?.data || [];
    const recentInvoices = invoicesArray.slice(0, 5).map((invoice: { invoice_id: string; invoice_number: string; date: string; status: string; total: number; due_date: string; balance: number }) => ({
      id: invoice.invoice_id,
      number: invoice.invoice_number,
      date: invoice.date,
      status: invoice.status,
      total: invoice.total,
      due_date: invoice.due_date,
      balance: invoice.balance,
    }));

    return mobileSuccess({
      balance: {
        outstanding: balanceData?.outstanding || 0,
        unused_credits: balanceData?.unused_credits || 0,
        currency: balanceData?.currency_code || user.currencyCode || 'IQD',
      },
      order_stats: orderStats,
      recent_orders: recentOrders,
      recent_invoices: recentInvoices,
      user: {
        name: user.name,
        email: user.email,
        currency: user.currencyCode,
      },
    });

  } catch (error) {
    console.error('[Mobile Dashboard] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load dashboard',
      'فشل تحميل لوحة التحكم',
      500
    );
  }
}
