// ============================================
// Odoo Invoices API - Server Only
// ============================================
// Replaces Odoo invoices API with Odoo account.move
// Maintains same return types (Invoice) for page compatibility
// ============================================

import { odooSearchRead, odooRead, odooCount } from './client';
import type { OdooInvoice } from './types';
import type { Invoice, LineItem, PaymentInfo, PaginatedResponse } from '@/types';

// ============================================
// Fields
// ============================================

const INVOICE_FIELDS = [
  'id', 'name', 'move_type', 'state', 'partner_id',
  'invoice_date', 'invoice_date_due',
  'amount_untaxed', 'amount_tax', 'amount_total', 'amount_residual',
  'currency_id', 'payment_state', 'invoice_line_ids',
  'ref', 'narration', 'create_date', 'write_date',
];

const INVOICE_LINE_FIELDS = [
  'id', 'product_id', 'name', 'quantity', 'price_unit',
  'discount', 'price_subtotal', 'price_total',
  'tax_ids', 'product_uom_id',
  'account_id', 'display_type',
];

// ============================================
// State mapping
// ============================================

function mapInvoiceStatus(state: string, paymentState: string): string {
  if (state === 'cancel') return 'void';
  if (state === 'draft') return 'draft';
  // posted
  if (paymentState === 'paid') return 'paid';
  if (paymentState === 'partial') return 'partially_paid';
  if (paymentState === 'in_payment') return 'partially_paid';
  return 'sent'; // posted but not paid
}

// ============================================
// Conversion
// ============================================

interface OdooInvoiceLine {
  id: number;
  product_id: [number, string] | false;
  name: string;
  quantity: number;
  price_unit: number;
  discount: number;
  price_subtotal: number;
  price_total: number;
  tax_ids: [number, string][];
  product_uom_id: [number, string] | false;
  account_id: [number, string] | false;
  display_type: string | false;
}

function formatInvoice(inv: OdooInvoice, lines: OdooInvoiceLine[] = []): Invoice {
  const currencyCode = Array.isArray(inv.currency_id) ? inv.currency_id[1] : 'IQD';
  const paid = inv.amount_total - inv.amount_residual;

  // Filter out section/note lines, keep only product lines
  const productLines = lines.filter(l => !l.display_type);

  return {
    invoice_id: String(inv.id),
    invoice_number: inv.name || '',
    date: (inv.invoice_date || '') as string,
    due_date: (inv.invoice_date_due || '') as string,
    status: mapInvoiceStatus(inv.state, inv.payment_state),
    customer_id: Array.isArray(inv.partner_id) ? String(inv.partner_id[0]) : '',
    customer_name: Array.isArray(inv.partner_id) ? inv.partner_id[1] : '',
    reference_number: (inv.ref || undefined) as string | undefined,
    total: inv.amount_total,
    balance: inv.amount_residual,
    sub_total: inv.amount_untaxed,
    tax_total: inv.amount_tax,
    discount: 0,
    currency_code: currencyCode,
    currency_symbol: currencyCode === 'USD' ? '$' : 'IQD',
    exchange_rate: 1,
    payment_made: paid,
    credits_applied: 0,
    write_off_amount: 0,
    notes: (inv.narration || undefined) as string | undefined,
    line_items: productLines.map(formatInvoiceLine),
    payments: [], // Would need account.payment lookup for full detail
    created_time: inv.create_date,
    last_modified_time: inv.write_date,
  };
}

function formatInvoiceLine(l: OdooInvoiceLine): LineItem {
  return {
    line_item_id: String(l.id),
    item_id: Array.isArray(l.product_id) ? String(l.product_id[0]) : '',
    item_name: Array.isArray(l.product_id) ? l.product_id[1] : '',
    name: l.name,
    description: l.name,
    rate: l.price_unit,
    quantity: l.quantity,
    unit: Array.isArray(l.product_uom_id) ? l.product_uom_id[1] : 'Unit',
    item_total: l.price_subtotal,
    discount: l.discount,
  };
}

// ============================================
// API Functions
// ============================================

/**
 * Get invoices for a customer (paginated)
 */
export async function getCustomerInvoices(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<Invoice>> {
  try {
    const partnerId = parseInt(customerId, 10);
    const domain = [
      ['partner_id', '=', partnerId],
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
    ];
    const offset = (page - 1) * perPage;

    const [invoices, total] = await Promise.all([
      odooSearchRead<OdooInvoice>('account.move', domain, INVOICE_FIELDS, {
        offset,
        limit: perPage,
        order: 'invoice_date desc, id desc',
      }),
      odooCount('account.move', domain),
    ]);

    return {
      data: invoices.map(inv => formatInvoice(inv)),
      page_context: {
        page,
        per_page: perPage,
        has_more_page: offset + perPage < total,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  } catch (error) {
    console.error('[Odoo Invoices] Error:', error);
    return {
      data: [],
      page_context: { page: 1, per_page: perPage, has_more_page: false, total: 0, total_pages: 0 },
    };
  }
}

/**
 * Get single invoice by ID with lines
 */
export async function getInvoice(
  invoiceId: string,
  customerId: string
): Promise<Invoice | null> {
  try {
    const numId = parseInt(invoiceId, 10);
    const invoices = await odooRead<OdooInvoice>('account.move', [numId], INVOICE_FIELDS);
    if (!invoices.length) return null;

    const inv = invoices[0];

    // Security check
    if (Array.isArray(inv.partner_id) && String(inv.partner_id[0]) !== customerId) {
      console.warn(`[Odoo Invoices] Invoice ${invoiceId} does not belong to customer ${customerId}`);
      return null;
    }

    // Fetch lines
    let lines: OdooInvoiceLine[] = [];
    if (inv.invoice_line_ids?.length) {
      lines = await odooRead<OdooInvoiceLine>('account.move.line', inv.invoice_line_ids, INVOICE_LINE_FIELDS);
    }

    return formatInvoice(inv, lines);
  } catch (error) {
    console.error(`[Odoo Invoices] Error fetching invoice ${invoiceId}:`, error);
    return null;
  }
}

/**
 * Get recent invoices for dashboard
 */
export async function getRecentInvoices(
  customerId: string,
  limit = 5
): Promise<Invoice[]> {
  const result = await getCustomerInvoices(customerId, 1, limit);
  return result.data;
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(customerId: string): Promise<Invoice[]> {
  try {
    const partnerId = parseInt(customerId, 10);
    const today = new Date().toISOString().split('T')[0];

    const invoices = await odooSearchRead<OdooInvoice>('account.move', [
      ['partner_id', '=', partnerId],
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['payment_state', 'in', ['not_paid', 'partial']],
      ['invoice_date_due', '<', today],
    ], INVOICE_FIELDS, { limit: 50, order: 'invoice_date_due asc' });

    return invoices.map(inv => formatInvoice(inv));
  } catch (error) {
    console.error('[Odoo Invoices] Error fetching overdue:', error);
    return [];
  }
}

/**
 * Invoice summary stats
 */
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

export async function getInvoiceSummaryStats(customerId: string): Promise<InvoiceSummaryStats> {
  try {
    const partnerId = parseInt(customerId, 10);
    const base = [
      ['partner_id', '=', partnerId],
      ['move_type', '=', 'out_invoice'],
    ];
    const today = new Date().toISOString().split('T')[0];

    const [totalCount, paidCount, overdueCount, unpaidCount] = await Promise.all([
      odooCount('account.move', [...base, ['state', '=', 'posted']]),
      odooCount('account.move', [...base, ['state', '=', 'posted'], ['payment_state', '=', 'paid']]),
      odooCount('account.move', [
        ...base, ['state', '=', 'posted'],
        ['payment_state', 'in', ['not_paid', 'partial']],
        ['invoice_date_due', '<', today],
      ]),
      odooCount('account.move', [
        ...base, ['state', '=', 'posted'],
        ['payment_state', 'in', ['not_paid', 'partial']],
      ]),
    ]);

    return {
      totalAmount: 0,
      paidAmount: 0,
      balanceAmount: 0,
      overdueAmount: 0,
      overdueCount,
      pendingAmount: 0,
      pendingCount: Math.max(0, unpaidCount - overdueCount),
      paidCount,
      totalCount,
    };
  } catch (error) {
    console.error('[Odoo Invoices] Error getting stats:', error);
    return {
      totalAmount: 0, paidAmount: 0, balanceAmount: 0,
      overdueAmount: 0, overdueCount: 0,
      pendingAmount: 0, pendingCount: 0,
      paidCount: 0, totalCount: 0,
    };
  }
}

// Status mapping for UI
export const INVOICE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  sent: { label: 'Sent', color: 'blue' },
  partially_paid: { label: 'Partially Paid', color: 'yellow' },
  paid: { label: 'Paid', color: 'green' },
  void: { label: 'Void', color: 'gray' },
};
