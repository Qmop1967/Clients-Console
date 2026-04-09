// ============================================
// Odoo Payments API - Server Only
// ============================================
// Replaces Odoo payments API with Odoo account.payment
// Maintains same return types (Payment) for page compatibility
// ============================================

import { odooSearchRead, odooRead, odooCount } from './client';
import type { OdooPayment } from './types';
import type { Payment, PaginatedResponse } from '@/types';

// ============================================
// Fields
// ============================================

const PAYMENT_FIELDS = [
  'id', 'name', 'payment_type', 'partner_type', 'partner_id',
  'amount', 'currency_id', 'date', 'state',
  'ref', 'journal_id', 'payment_method_id',
  'create_date', 'write_date',
];

// ============================================
// Conversion
// ============================================

function formatPayment(p: OdooPayment): Payment {
  const currencyCode = Array.isArray(p.currency_id) ? p.currency_id[1] : 'IQD';
  const journal = Array.isArray(p.journal_id) ? p.journal_id[1] : '';

  return {
    payment_id: String(p.id),
    payment_number: p.name || '',
    date: p.date || '',
    amount: p.amount,
    unused_amount: 0,
    customer_id: Array.isArray(p.partner_id) ? String(p.partner_id[0]) : '',
    customer_name: Array.isArray(p.partner_id) ? p.partner_id[1] : '',
    payment_mode: journal,
    reference_number: (p.ref || undefined) as string | undefined,
    description: (p.ref || undefined) as string | undefined,
    currency_code: currencyCode,
    currency_symbol: currencyCode === 'USD' ? '$' : 'IQD',
    exchange_rate: 1,
    invoices: [], // Would need reconciliation lookup
    created_time: p.create_date,
    last_modified_time: p.write_date,
  };
}

// ============================================
// API Functions
// ============================================

/**
 * Get payments for a customer (paginated, inbound only = customer receipts)
 */
export async function getCustomerPayments(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<Payment>> {
  try {
    const partnerId = parseInt(customerId, 10);
    const domain = [
      ['partner_id', '=', partnerId],
      ['payment_type', '=', 'inbound'],
      ['partner_type', '=', 'customer'],
    ];
    const offset = (page - 1) * perPage;

    const [payments, total] = await Promise.all([
      odooSearchRead<OdooPayment>('account.payment', domain, PAYMENT_FIELDS, {
        offset,
        limit: perPage,
        order: 'date desc, id desc',
      }),
      odooCount('account.payment', domain),
    ]);

    return {
      data: payments.map(formatPayment),
      page_context: {
        page,
        per_page: perPage,
        has_more_page: offset + perPage < total,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  } catch (error) {
    console.error('[Odoo Payments] Error:', error);
    return {
      data: [],
      page_context: { page: 1, per_page: perPage, has_more_page: false, total: 0, total_pages: 0 },
    };
  }
}

/**
 * Get single payment by ID
 */
export async function getPayment(
  paymentId: string,
  customerId: string
): Promise<Payment | null> {
  try {
    const numId = parseInt(paymentId, 10);
    const payments = await odooRead<OdooPayment>('account.payment', [numId], PAYMENT_FIELDS);
    if (!payments.length) return null;

    const p = payments[0];

    // Security check
    if (Array.isArray(p.partner_id) && String(p.partner_id[0]) !== customerId) {
      console.warn(`[Odoo Payments] Payment ${paymentId} does not belong to customer ${customerId}`);
      return null;
    }

    return formatPayment(p);
  } catch (error) {
    console.error(`[Odoo Payments] Error fetching payment ${paymentId}:`, error);
    return null;
  }
}

/**
 * Get recent payments for dashboard
 */
export async function getRecentPayments(
  customerId: string,
  limit = 5
): Promise<Payment[]> {
  const result = await getCustomerPayments(customerId, 1, limit);
  return result.data;
}

/**
 * Get payment totals in date range
 */
export async function getPaymentTotals(
  customerId: string,
  fromDate?: string,
  toDate?: string
): Promise<{ total: number; count: number }> {
  try {
    const partnerId = parseInt(customerId, 10);
    const domain: unknown[] = [
      ['partner_id', '=', partnerId],
      ['payment_type', '=', 'inbound'],
      ['partner_type', '=', 'customer'],
      ['state', '=', 'posted'],
    ];

    if (fromDate) domain.push(['date', '>=', fromDate]);
    if (toDate) domain.push(['date', '<=', toDate]);

    const payments = await odooSearchRead<OdooPayment>(
      'account.payment', domain, ['amount'], { limit: 500 }
    );

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    return { total, count: payments.length };
  } catch (error) {
    console.error('[Odoo Payments] Error getting totals:', error);
    return { total: 0, count: 0 };
  }
}
