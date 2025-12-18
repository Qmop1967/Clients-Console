// ============================================
// Mobile Invoice Detail API
// GET /api/mobile/invoices/[id]
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getInvoice } from '@/lib/zoho/invoices';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const authResult = await requireMobileAuth(request);
    if (isAuthError(authResult)) {
      return authResult;
    }

    const auth = authResult;
    const user = auth.user!;

    if (!id) {
      return mobileError(
        'INVALID_ID',
        'Invoice ID is required',
        'معرف الفاتورة مطلوب',
        400
      );
    }

    // Fetch invoice detail
    const invoice = await getInvoice(id, user.zohoContactId);

    if (!invoice) {
      return mobileError(
        'NOT_FOUND',
        'Invoice not found',
        'الفاتورة غير موجودة',
        404
      );
    }

    // Verify invoice belongs to this customer (double-check)
    if (invoice.customer_id !== user.zohoContactId) {
      return mobileError(
        'FORBIDDEN',
        'You do not have access to this invoice',
        'ليس لديك حق الوصول إلى هذه الفاتورة',
        403
      );
    }

    // Transform line items (use name || item_name for API compatibility)
    const lineItems = (invoice.line_items || []).map((item) => ({
      id: item.line_item_id,
      item_id: item.item_id,
      name: item.name || item.item_name || '',
      sku: item.sku || null,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.item_total || (item.quantity * item.rate),
      tax: 0,
    }));

    // Transform payments
    const payments = (invoice.payments || []).map((payment: { payment_id: string; date: string; amount: number; payment_mode?: string }) => ({
      id: payment.payment_id,
      date: payment.date,
      amount: payment.amount,
      reference: null,
      mode: payment.payment_mode || null,
    }));

    return mobileSuccess({
      invoice: {
        id: invoice.invoice_id,
        number: invoice.invoice_number,
        date: invoice.date,
        due_date: invoice.due_date,
        status: invoice.status,
        subtotal: invoice.sub_total,
        tax: invoice.tax_total || 0,
        discount: invoice.discount || 0,
        total: invoice.total,
        balance: invoice.balance || 0,
        currency: invoice.currency_code || user.currencyCode,
        notes: invoice.notes || null,
        terms: invoice.terms || null,
        line_items: lineItems,
        payments: payments,
        is_paid: invoice.status === 'paid',
        is_overdue: invoice.status === 'overdue',
        payment_made: invoice.payment_made || 0,
        credits_applied: invoice.credits_applied || 0,
      },
    });

  } catch (error) {
    console.error('[Mobile Invoice Detail] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load invoice details',
      'فشل تحميل تفاصيل الفاتورة',
      500
    );
  }
}
