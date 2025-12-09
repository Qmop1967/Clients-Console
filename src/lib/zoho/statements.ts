// ============================================
// Zoho Account Statements API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoInvoice, ZohoPayment, ZohoCreditNote } from '@/types';

// Transaction types for statement
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

interface ZohoInvoicesResponse {
  invoices: ZohoInvoice[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

interface ZohoPaymentsResponse {
  customerpayments: ZohoPayment[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

interface ZohoCreditNotesResponse {
  creditnotes: ZohoCreditNote[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

// Fetch all invoices for a customer
async function fetchAllInvoices(customerId: string): Promise<ZohoInvoice[]> {
  const allInvoices: ZohoInvoice[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoInvoicesResponse>('/invoices', {
        params: {
          customer_id: customerId,
          page,
          per_page: 200,
          sort_column: 'date',
          sort_order: 'A', // Ascending for statement
        },
      })
    );

    allInvoices.push(...(data.invoices || []));
    hasMore = data.page_context?.has_more_page || false;
    page++;
  }

  return allInvoices;
}

// Fetch all payments for a customer
async function fetchAllPayments(customerId: string): Promise<ZohoPayment[]> {
  const allPayments: ZohoPayment[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoPaymentsResponse>('/customerpayments', {
        params: {
          customer_id: customerId,
          page,
          per_page: 200,
          sort_column: 'date',
          sort_order: 'A',
        },
      })
    );

    allPayments.push(...(data.customerpayments || []));
    hasMore = data.page_context?.has_more_page || false;
    page++;
  }

  return allPayments;
}

// Fetch all credit notes for a customer
async function fetchAllCreditNotes(customerId: string): Promise<ZohoCreditNote[]> {
  const allCreditNotes: ZohoCreditNote[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoCreditNotesResponse>('/creditnotes', {
        params: {
          customer_id: customerId,
          page,
          per_page: 200,
          sort_column: 'date',
          sort_order: 'A',
        },
      })
    );

    allCreditNotes.push(...(data.creditnotes || []));
    hasMore = data.page_context?.has_more_page || false;
    page++;
  }

  return allCreditNotes;
}

// Get account statement with all transactions
export async function getAccountStatement(
  customerId: string,
  fromDate?: string,
  toDate?: string
): Promise<AccountStatementData> {
  const getCachedStatement = unstable_cache(
    async () => {
      try {
        // Fetch all data in parallel
        const [invoices, payments, creditNotes] = await Promise.all([
          fetchAllInvoices(customerId),
          fetchAllPayments(customerId),
          fetchAllCreditNotes(customerId),
        ]);

        // Convert to transactions
        const transactions: StatementTransaction[] = [];

        // Add invoices (debits)
        for (const invoice of invoices) {
          transactions.push({
            transaction_id: invoice.invoice_id,
            transaction_type: 'invoice',
            transaction_number: invoice.invoice_number,
            date: invoice.date,
            due_date: invoice.due_date,
            debit: invoice.total,
            credit: 0,
            balance: 0, // Will be calculated later
            description: `Invoice - ${invoice.status || 'Pending'}`,
            status: invoice.status,
            reference_number: invoice.reference_number,
          });
        }

        // Add payments (credits)
        for (const payment of payments) {
          transactions.push({
            transaction_id: payment.payment_id,
            transaction_type: 'payment',
            transaction_number: payment.payment_number,
            date: payment.date,
            debit: 0,
            credit: payment.amount,
            balance: 0,
            description: `Payment - ${payment.payment_mode || 'Unknown'}`,
            reference_number: payment.reference_number,
          });
        }

        // Add credit notes (credits)
        for (const creditNote of creditNotes) {
          transactions.push({
            transaction_id: creditNote.creditnote_id,
            transaction_type: 'credit_note',
            transaction_number: creditNote.creditnote_number,
            date: creditNote.date,
            debit: 0,
            credit: creditNote.total,
            balance: 0,
            description: `Credit Note - ${creditNote.status || 'Applied'}`,
            status: creditNote.status,
            reference_number: creditNote.reference_number,
          });
        }

        // Sort by date (oldest first)
        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Filter by date range if provided
        let filteredTransactions = transactions;
        if (fromDate) {
          filteredTransactions = filteredTransactions.filter(
            (t) => new Date(t.date) >= new Date(fromDate)
          );
        }
        if (toDate) {
          filteredTransactions = filteredTransactions.filter(
            (t) => new Date(t.date) <= new Date(toDate)
          );
        }

        // Calculate running balance
        let balance = 0;
        let totalDebits = 0;
        let totalCredits = 0;

        for (const tx of filteredTransactions) {
          totalDebits += tx.debit;
          totalCredits += tx.credit;
          balance = balance + tx.debit - tx.credit;
          tx.balance = balance;
        }

        // Determine date range
        const dates = filteredTransactions.map((t) => t.date).sort();
        const firstDate = fromDate || dates[0] || new Date().toISOString().split('T')[0];
        const lastDate = toDate || dates[dates.length - 1] || new Date().toISOString().split('T')[0];

        // Get currency from first invoice or default to IQD (TSH's home currency)
        const currencyCode = invoices[0]?.currency_code || 'IQD';

        return {
          opening_balance: 0, // We start from 0 in the statement view
          closing_balance: balance,
          total_debits: totalDebits,
          total_credits: totalCredits,
          currency_code: currencyCode,
          from_date: firstDate,
          to_date: lastDate,
          transactions: filteredTransactions,
        };
      } catch (error) {
        console.error('Error fetching account statement:', error);
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
    },
    [`statement-${customerId}-${fromDate || 'all'}-${toDate || 'all'}`],
    {
      revalidate: 300, // 5 minutes
      tags: [CACHE_TAGS.INVOICES(customerId), CACHE_TAGS.PAYMENTS(customerId)],
    }
  );

  return getCachedStatement();
}

// Get statement summary (quick stats without all transactions)
export async function getStatementSummary(
  customerId: string
): Promise<{
  totalInvoiced: number;
  totalPaid: number;
  totalCredits: number;
  balance: number;
  currency_code: string;
}> {
  const getCachedSummary = unstable_cache(
    async () => {
      try {
        const [invoices, payments, creditNotes] = await Promise.all([
          fetchAllInvoices(customerId),
          fetchAllPayments(customerId),
          fetchAllCreditNotes(customerId),
        ]);

        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const totalPaid = payments.reduce((sum, pmt) => sum + pmt.amount, 0);
        const totalCredits = creditNotes.reduce((sum, cn) => sum + cn.total, 0);
        const balance = totalInvoiced - totalPaid - totalCredits;
        // Get currency from first invoice or default to IQD (TSH's home currency)
        const currencyCode = invoices[0]?.currency_code || 'IQD';

        return {
          totalInvoiced,
          totalPaid,
          totalCredits,
          balance,
          currency_code: currencyCode,
        };
      } catch (error) {
        console.error('Error fetching statement summary:', error);
        return {
          totalInvoiced: 0,
          totalPaid: 0,
          totalCredits: 0,
          balance: 0,
          currency_code: 'IQD',
        };
      }
    },
    [`statement-summary-${customerId}`],
    {
      revalidate: 300,
      tags: [CACHE_TAGS.INVOICES(customerId), CACHE_TAGS.PAYMENTS(customerId)],
    }
  );

  return getCachedSummary();
}
