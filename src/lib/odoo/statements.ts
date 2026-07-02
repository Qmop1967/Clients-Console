// ============================================
// Odoo Account Statements API - Server Only
// ============================================
// FIX 2026-07-02 (customer complaint: statement balance != dashboard balance)
// OLD approach rebuilt the balance from documents only (invoices + payments
// + credit notes) starting from ZERO. Opening balances migrated from Zoho
// and manual journal entries were invisible, so the statement diverged from
// the dashboard (which reads the real receivable ledger).
// NEW approach: the statement IS the receivable ledger. Every posted
// account.move.line on the customer receivable account (161 IQD / 194 USD)
// becomes one statement row. closing_balance therefore equals the dashboard
// balance by construction - they read the same rows.
// ============================================

import { odooSearchRead, odooRead } from './client';

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
// Ledger constants + helpers
// ============================================

const RECEIVABLE_IQD = 161;
const RECEIVABLE_USD = 194;

interface LedgerLine {
  id: number;
  date: string | false;
  move_id: [number, string] | false;
  journal_id: [number, string] | false;
  name: string | false;
  ref: string | false;
  amount_currency: number;
  move_type: string;
}

async function resolvePartnerCurrency(partnerId: number): Promise<'USD' | 'IQD'> {
  try {
    const rows = await odooRead<{ x_currency?: string | false }>(
      'res.partner', [partnerId], ['x_currency']
    );
    if (rows?.[0]?.x_currency === 'USD') return 'USD';
  } catch { /* default IQD */ }
  return 'IQD';
}

/** All posted receivable-ledger lines for the partner, oldest first, paginated. */
async function fetchLedgerLines(partnerId: number, accountId: number): Promise<LedgerLine[]> {
  const all: LedgerLine[] = [];
  const page = 1000;
  let offset = 0;
  for (;;) {
    const batch = await odooSearchRead<LedgerLine>(
      'account.move.line',
      [
        ['partner_id', '=', partnerId],
        ['account_id', '=', accountId],
        ['parent_state', '=', 'posted'],
      ],
      ['id', 'date', 'move_id', 'journal_id', 'name', 'ref', 'amount_currency', 'move_type'],
      { limit: page, offset, order: 'date asc, id asc' }
    );
    all.push(...batch);
    if (batch.length < page) break;
    offset += page;
    if (offset > 20000) break; // hard safety valve
  }
  return all;
}

async function fetchJournalTypes(): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  try {
    const journals = await odooSearchRead<{ id: number; type: string }>(
      'account.journal', [], ['id', 'type'], { limit: 200 }
    );
    for (const j of journals) map[j.id] = j.type;
  } catch { /* fallback: entries without bank/cash detection */ }
  return map;
}

/** move_id -> account.payment id, so payment rows keep linking to /payments/{id}. */
async function fetchPaymentMoveMap(partnerId: number): Promise<Record<number, number>> {
  const map: Record<number, number> = {};
  try {
    const pays = await odooSearchRead<{ id: number; move_id: [number, string] | false }>(
      'account.payment', [['partner_id', '=', partnerId]], ['id', 'move_id'], { limit: 4000 }
    );
    for (const p of pays) {
      if (Array.isArray(p.move_id)) map[p.move_id[0]] = p.id;
    }
  } catch { /* links fall back to move id */ }
  return map;
}

function classify(
  line: LedgerLine,
  journalTypes: Record<number, string>
): StatementTransaction['transaction_type'] {
  if (line.move_type === 'out_invoice') return 'invoice';
  if (line.move_type === 'out_refund') return 'credit_note';
  const jid = Array.isArray(line.journal_id) ? line.journal_id[0] : 0;
  const jt = journalTypes[jid] || '';
  if (jt === 'bank' || jt === 'cash') return 'payment';
  // Zoho opening balances + manual journal adjustments
  return 'opening_balance';
}

function toTransaction(
  line: LedgerLine,
  journalTypes: Record<number, string>,
  paymentMoves: Record<number, number>,
  runningBalance: number
): StatementTransaction {
  const amt = line.amount_currency || 0;
  const type = classify(line, journalTypes);
  const moveId = Array.isArray(line.move_id) ? line.move_id[0] : line.id;
  const moveName = Array.isArray(line.move_id) ? line.move_id[1] : '';
  const txId = type === 'payment' && paymentMoves[moveId]
    ? String(paymentMoves[moveId])
    : String(moveId);
  const rawName = typeof line.name === 'string' ? line.name.split('\n')[0].trim() : '';
  const journalName = Array.isArray(line.journal_id) ? line.journal_id[1] : '';
  let description = '';
  if (type === 'payment') description = journalName;
  else if (rawName && rawName !== moveName) description = rawName;
  else description = (line.ref as string) || journalName || '';

  return {
    transaction_id: txId,
    transaction_type: type,
    transaction_number: moveName || rawName || String(line.id),
    date: (line.date || '') as string,
    debit: amt > 0 ? amt : 0,
    credit: amt < 0 ? -amt : 0,
    balance: runningBalance,
    description,
    reference_number: (line.ref || undefined) as string | undefined,
  };
}

// ============================================
// Main Statement Function
// ============================================

/**
 * Account statement straight from the receivable ledger.
 * closing_balance is mathematically identical to the dashboard balance.
 */
export async function getAccountStatement(
  customerId: string,
  fromDate?: string,
  toDate?: string
): Promise<AccountStatementData> {
  try {
    const partnerId = parseInt(customerId, 10);
    const currency = await resolvePartnerCurrency(partnerId);
    const accountId = currency === 'USD' ? RECEIVABLE_USD : RECEIVABLE_IQD;

    const [lines, journalTypes, paymentMoves] = await Promise.all([
      fetchLedgerLines(partnerId, accountId),
      fetchJournalTypes(),
      fetchPaymentMoveMap(partnerId),
    ]);

    // Opening balance = ledger truth BEFORE the range (never a hardcoded zero)
    let opening = 0;
    const inRange: LedgerLine[] = [];
    for (const l of lines) {
      const d = (l.date || '') as string;
      if (fromDate && d < fromDate) { opening += l.amount_currency || 0; continue; }
      if (toDate && d > toDate) continue;
      inRange.push(l);
    }

    let balance = opening;
    let totalDebits = 0;
    let totalCredits = 0;
    const transactions: StatementTransaction[] = [];
    for (const l of inRange) {
      const amt = l.amount_currency || 0;
      if (amt > 0) totalDebits += amt; else totalCredits += -amt;
      balance += amt;
      transactions.push(toTransaction(l, journalTypes, paymentMoves, balance));
    }

    const dates = inRange.map((l) => (l.date || '') as string).filter(Boolean);
    const today = new Date().toISOString().split('T')[0];
    const firstDate = fromDate || dates[0] || today;
    const lastDate = toDate || dates[dates.length - 1] || today;

    return {
      opening_balance: opening,
      closing_balance: balance,
      total_debits: totalDebits,
      total_credits: totalCredits,
      currency_code: currency,
      from_date: firstDate,
      to_date: lastDate,
      transactions,
    };
  } catch (error) {
    console.error('[Odoo Statement] Error:', error);
    const today = new Date().toISOString().split('T')[0];
    return {
      opening_balance: 0,
      closing_balance: 0,
      total_debits: 0,
      total_credits: 0,
      currency_code: 'IQD',
      from_date: today,
      to_date: today,
      transactions: [],
    };
  }
}

/**
 * Quick statement summary (ledger-based, same source as dashboard).
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
    const currency = await resolvePartnerCurrency(partnerId);
    const accountId = currency === 'USD' ? RECEIVABLE_USD : RECEIVABLE_IQD;
    const [lines, journalTypes] = await Promise.all([
      fetchLedgerLines(partnerId, accountId),
      fetchJournalTypes(),
    ]);

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalCredits = 0;
    let balance = 0;
    for (const l of lines) {
      const amt = l.amount_currency || 0;
      balance += amt;
      const type = classify(l, journalTypes);
      if (type === 'invoice') totalInvoiced += Math.max(0, amt);
      else if (type === 'payment') totalPaid += Math.max(0, -amt);
      else if (type === 'credit_note') totalCredits += Math.max(0, -amt);
    }

    return { totalInvoiced, totalPaid, totalCredits, balance, currency_code: currency };
  } catch (error) {
    console.error('[Odoo Statement] Error getting summary:', error);
    return { totalInvoiced: 0, totalPaid: 0, totalCredits: 0, balance: 0, currency_code: 'IQD' };
  }
}
