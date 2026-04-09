// ============================================
// Odoo Account Statements API - Server Only
// ============================================
// Replaces Odoo statements with Odoo account.move.line
// Builds statement from invoices + payments + credit notes
// ============================================

import { odooSearchRead } from './client';
import type { OdooInvoice, OdooPayment } from './types';

// ============================================
// Types (matching statement types)
// ============================================

export interface StatementTransaction {
  transaction_id: string;
  transaction_type: 'invoice' | 'payment' | 'credit_note' | 'debit_note' | 'opening_balance';
  transaction_number: string;
  date: string;
  due_date?: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  status?: string;
  reference_number?: string;
}

export interface AccountStatementData {
  opening_balance: number;
  closing_balance: number;
  total_debits: number;
  total_credits: number;
  currency_code: string;
  from_date: string;
  to_date: string;
  transactions: StatementTransaction[];
}

// ============================================
// Helpers — fetch all pages
// ============================================

async function fetchAllInvoices(partnerId: number, currencyId?: number): Promise<OdooInvoice[]> {
  const domain: unknown[] = [
    ['partner_id', '=', partnerId],
    ['move_type', '=', 'out_invoice'],
    ['state', '=', 'posted'],
  ];
  if (currencyId) domain.push(['currency_id', '=', currencyId]);
  return odooSearchRead<OdooInvoice>(
    'account.move',
    domain,
    ['id', 'name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual',
     'currency_id', 'payment_state', 'ref', 'state'],
    { limit: 2000, order: 'invoice_date asc, id asc' }
  );
}

async function fetchAllCreditNotes(partnerId: number, currencyId?: number): Promise<OdooInvoice[]> {
  const domain: unknown[] = [
    ['partner_id', '=', partnerId],
    ['move_type', '=', 'out_refund'],
    ['state', '=', 'posted'],
  ];
  if (currencyId) domain.push(['currency_id', '=', currencyId]);
  return odooSearchRead<OdooInvoice>(
    'account.move',
    domain,
    ['id', 'name', 'invoice_date', 'amount_total', 'currency_id', 'payment_state', 'ref', 'state'],
    { limit: 500, order: 'invoice_date asc, id asc' }
  );
}

async function fetchAllPayments(partnerId: number, currencyId?: number): Promise<OdooPayment[]> {
  const domain: unknown[] = [
    ['partner_id', '=', partnerId],
    ['payment_type', '=', 'inbound'],
    ['partner_type', '=', 'customer'],
    ['state', '=', 'posted'],
  ];
  if (currencyId) domain.push(['currency_id', '=', currencyId]);
  return odooSearchRead<OdooPayment>(
    'account.payment',
    domain,
    ['id', 'name', 'date', 'amount', 'currency_id', 'ref', 'journal_id'],
    { limit: 2000, order: 'date asc, id asc' }
  );
}

// ============================================
// Main Statement Function
// ============================================

/**
 * Build account statement from invoices, payments, and credit notes
 */
export async function getAccountStatement(
  customerId: string,
  fromDate?: string,
  toDate?: string
): Promise<AccountStatementData> {
  try {
    const partnerId = parseInt(customerId, 10);

    // Determine customer currency for filtering
    let customerCurrencyId: number | undefined;
    try {
      const gwUrl = process.env.API_GATEWAY_URL || process.env.GATEWAY_URL || 'http://127.0.0.1:3010';
      const gwKey = process.env.GATEWAY_API_KEY || process.env.API_KEY || '';
      const custRes = await fetch(`${gwUrl}/api/odoo/call`, {
        method: 'POST',
        headers: { 'x-api-key': gwKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'res.partner', method: 'read',
          args: [[partnerId], ['x_currency']],
        }),
      });
      const custData = await custRes.json();
      if (custData.success && custData.data?.[0]) {
        const xCurr = custData.data[0].x_currency;
        // USD = currency_id 2, IQD = currency_id 22 (typical Odoo)
        if (xCurr === "USD") customerCurrencyId = 1;
        else if (xCurr === "IQD") customerCurrencyId = 87;
      }
    } catch { /* ignore — will show all currencies */ }

    // Fetch all in parallel — filtered by customer currency
    const [invoices, payments, creditNotes] = await Promise.all([
      fetchAllInvoices(partnerId, customerCurrencyId),
      fetchAllPayments(partnerId, customerCurrencyId),
      fetchAllCreditNotes(partnerId, customerCurrencyId),
    ]);

    const transactions: StatementTransaction[] = [];

    // Invoices → debit
    for (const inv of invoices) {
      transactions.push({
        transaction_id: String(inv.id),
        transaction_type: 'invoice',
        transaction_number: inv.name || '',
        date: (inv.invoice_date || '') as string,
        due_date: (inv.invoice_date_due || undefined) as string | undefined,
        debit: inv.amount_total,
        credit: 0,
        balance: 0,
        description: `Invoice - ${inv.payment_state || inv.state}`,
        status: inv.state,
        reference_number: (inv.ref || undefined) as string | undefined,
      });
    }

    // Payments → credit
    for (const p of payments) {
      transactions.push({
        transaction_id: String(p.id),
        transaction_type: 'payment',
        transaction_number: p.name || '',
        date: p.date || '',
        debit: 0,
        credit: p.amount,
        balance: 0,
        description: `Payment - ${Array.isArray(p.journal_id) ? p.journal_id[1] : ''}`,
        reference_number: (p.ref || undefined) as string | undefined,
      });
    }

    // Credit notes → credit
    for (const cn of creditNotes) {
      transactions.push({
        transaction_id: String(cn.id),
        transaction_type: 'credit_note',
        transaction_number: cn.name || '',
        date: (cn.invoice_date || '') as string,
        debit: 0,
        credit: cn.amount_total,
        balance: 0,
        description: `Credit Note - ${cn.payment_state || cn.state}`,
        status: cn.state,
        reference_number: (cn.ref || undefined) as string | undefined,
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter by date range
    let filtered = transactions;
    if (fromDate) filtered = filtered.filter(t => t.date >= fromDate);
    if (toDate) filtered = filtered.filter(t => t.date <= toDate);

    // Calculate running balance
    let balance = 0;
    let totalDebits = 0;
    let totalCredits = 0;

    for (const tx of filtered) {
      totalDebits += tx.debit;
      totalCredits += tx.credit;
      balance = balance + tx.debit - tx.credit;
      tx.balance = balance;
    }

    // Date range
    const dates = filtered.map(t => t.date).filter(Boolean).sort();
    const firstDate = fromDate || dates[0] || new Date().toISOString().split('T')[0];
    const lastDate = toDate || dates[dates.length - 1] || new Date().toISOString().split('T')[0];

    // Currency from first invoice
    const currencyCode = invoices[0] && Array.isArray(invoices[0].currency_id)
      ? invoices[0].currency_id[1] : 'IQD';

    return {
      opening_balance: 0,
      closing_balance: balance,
      total_debits: totalDebits,
      total_credits: totalCredits,
      currency_code: currencyCode,
      from_date: firstDate,
      to_date: lastDate,
      transactions: filtered,
    };
  } catch (error) {
    console.error('[Odoo Statement] Error:', error);
    return {
      opening_balance: 0,
      closing_balance: 0,
      total_debits: 0,
      total_credits: 0,
      currency_code: 'IQD',
      from_date: new Date().toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
      transactions: [],
    };
  }
}

/**
 * Quick statement summary (no transaction details)
 */
export async function getStatementSummary(
  customerId: string
): Promise<{
  totalInvoiced: number;
  totalPaid: number;
  totalCredits: number;
  balance: number;
  currency_code: string;
}> {
  try {
    const partnerId = parseInt(customerId, 10);

    const [invoices, payments, creditNotes] = await Promise.all([
      fetchAllInvoices(partnerId),
      fetchAllPayments(partnerId),
      fetchAllCreditNotes(partnerId),
    ]);

    const totalInvoiced = invoices.reduce((s, i) => s + i.amount_total, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalCredits = creditNotes.reduce((s, c) => s + c.amount_total, 0);
    const currencyCode = invoices[0] && Array.isArray(invoices[0].currency_id)
      ? invoices[0].currency_id[1] : 'IQD';

    return {
      totalInvoiced,
      totalPaid,
      totalCredits,
      balance: totalInvoiced - totalPaid - totalCredits,
      currency_code: currencyCode,
    };
  } catch (error) {
    console.error('[Odoo Statement] Error getting summary:', error);
    return { totalInvoiced: 0, totalPaid: 0, totalCredits: 0, balance: 0, currency_code: 'IQD' };
  }
}
