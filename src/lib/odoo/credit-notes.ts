// ============================================
// Odoo Credit Notes API - Server Only
// ============================================
// Replaces Odoo credit notes API with Odoo account.move (out_refund)
// Maintains same return types (CreditNote) for page compatibility
// ============================================

import { odooSearchRead, odooRead, odooCount } from './client';
import type { OdooInvoice } from './types';
import type { CreditNote, LineItem, PaginatedResponse } from '@/types';

// ============================================
// Fields (reuse invoice fields — same model)
// ============================================

const CN_FIELDS = [
  'id', 'name', 'move_type', 'state', 'partner_id',
  'invoice_date', 'invoice_date_due',
  'amount_untaxed', 'amount_tax', 'amount_total', 'amount_residual',
  'currency_id', 'payment_state', 'invoice_line_ids',
  'ref', 'narration', 'create_date', 'write_date',
];

const CN_LINE_FIELDS = [
  'id', 'product_id', 'name', 'quantity', 'price_unit',
  'discount', 'price_subtotal', 'price_total',
  'product_uom_id', 'display_type',
];

// ============================================
// State mapping
// ============================================

function mapCNStatus(state: string, paymentState: string): string {
  if (state === 'cancel') return 'void';
  if (state === 'draft') return 'draft';
  if (paymentState === 'paid' || paymentState === 'reversed') return 'closed';
  return 'open';
}

// ============================================
// Conversion
// ============================================

interface OdooCNLine {
  id: number;
  product_id: [number, string] | false;
  name: string;
  quantity: number;
  price_unit: number;
  discount: number;
  price_subtotal: number;
  price_total: number;
  product_uom_id: [number, string] | false;
  display_type: string | false;
}

function formatCreditNote(cn: OdooInvoice, lines: OdooCNLine[] = []): CreditNote {
  const currencyCode = Array.isArray(cn.currency_id) ? cn.currency_id[1] : 'IQD';
  const productLines = lines.filter(l => !l.display_type);

  return {
    creditnote_id: String(cn.id),
    creditnote_number: cn.name || '',
    date: (cn.invoice_date || '') as string,
    status: mapCNStatus(cn.state, cn.payment_state),
    customer_id: Array.isArray(cn.partner_id) ? String(cn.partner_id[0]) : '',
    customer_name: Array.isArray(cn.partner_id) ? cn.partner_id[1] : '',
    reference_number: (cn.ref || undefined) as string | undefined,
    total: cn.amount_total,
    balance: cn.amount_residual,
    currency_code: currencyCode,
    currency_symbol: currencyCode === 'USD' ? '$' : 'IQD',
    notes: (cn.narration || undefined) as string | undefined,
    line_items: productLines.map(l => ({
      line_item_id: String(l.id),
      item_id: Array.isArray(l.product_id) ? String(l.product_id[0]) : '',
      item_name: Array.isArray(l.product_id) ? l.product_id[1] : '',
      name: l.name,
      rate: l.price_unit,
      quantity: l.quantity,
      unit: Array.isArray(l.product_uom_id) ? l.product_uom_id[1] : 'Unit',
      item_total: l.price_subtotal,
      discount: l.discount,
    })),
    created_time: cn.create_date,
    last_modified_time: cn.write_date,
  };
}

// ============================================
// API Functions
// ============================================

/**
 * Get credit notes for a customer (paginated)
 */
export async function getCustomerCreditNotes(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<CreditNote>> {
  try {
    const partnerId = parseInt(customerId, 10);
    const domain = [
      ['partner_id', '=', partnerId],
      ['move_type', '=', 'out_refund'],
    ];
    const offset = (page - 1) * perPage;

    const [notes, total] = await Promise.all([
      odooSearchRead<OdooInvoice>('account.move', domain, CN_FIELDS, {
        offset,
        limit: perPage,
        order: 'invoice_date desc, id desc',
      }),
      odooCount('account.move', domain),
    ]);

    return {
      data: notes.map(cn => formatCreditNote(cn)),
      page_context: {
        page,
        per_page: perPage,
        has_more_page: offset + perPage < total,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  } catch (error) {
    console.error('[Odoo CreditNotes] Error:', error);
    return {
      data: [],
      page_context: { page: 1, per_page: perPage, has_more_page: false, total: 0, total_pages: 0 },
    };
  }
}

/**
 * Get single credit note by ID with lines
 */
export async function getCreditNote(
  creditNoteId: string,
  customerId: string
): Promise<CreditNote | null> {
  try {
    const numId = parseInt(creditNoteId, 10);
    const records = await odooRead<OdooInvoice>('account.move', [numId], CN_FIELDS);
    if (!records.length) return null;

    const cn = records[0];

    // Security check
    if (Array.isArray(cn.partner_id) && String(cn.partner_id[0]) !== customerId) {
      console.warn(`[Odoo CreditNotes] CN ${creditNoteId} does not belong to customer ${customerId}`);
      return null;
    }

    let lines: OdooCNLine[] = [];
    if (cn.invoice_line_ids?.length) {
      lines = await odooRead<OdooCNLine>('account.move.line', cn.invoice_line_ids, CN_LINE_FIELDS);
    }

    return formatCreditNote(cn, lines);
  } catch (error) {
    console.error(`[Odoo CreditNotes] Error fetching ${creditNoteId}:`, error);
    return null;
  }
}

/**
 * Get available credit balance (open credit notes)
 */
export async function getAvailableCreditBalance(customerId: string): Promise<number> {
  try {
    const partnerId = parseInt(customerId, 10);
    const notes = await odooSearchRead<OdooInvoice>(
      'account.move',
      [
        ['partner_id', '=', partnerId],
        ['move_type', '=', 'out_refund'],
        ['state', '=', 'posted'],
        ['payment_state', 'in', ['not_paid', 'partial']],
      ],
      ['amount_residual'],
      { limit: 100 }
    );

    return notes.reduce((sum, cn) => sum + cn.amount_residual, 0);
  } catch (error) {
    console.error('[Odoo CreditNotes] Error getting balance:', error);
    return 0;
  }
}

// Status mapping for UI
export const CREDIT_NOTE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  open: { label: 'Open', color: 'blue' },
  closed: { label: 'Closed', color: 'green' },
  void: { label: 'Void', color: 'gray' },
};
