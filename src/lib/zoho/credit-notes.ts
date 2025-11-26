// ============================================
// Zoho Credit Notes API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoCreditNote, PaginatedResponse } from '@/types';

interface ZohoCreditNotesResponse {
  creditnotes: ZohoCreditNote[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

interface ZohoCreditNoteResponse {
  creditnote: ZohoCreditNote;
}

// Get customer credit notes (cached per customer)
export async function getCustomerCreditNotes(
  customerId: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse<ZohoCreditNote>> {
  const getCachedCreditNotes = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoCreditNotesResponse>('/creditnotes', {
            params: {
              customer_id: customerId,
              page,
              per_page: perPage,
              sort_column: 'date',
              sort_order: 'D',
            },
          })
        );

        return {
          data: data.creditnotes || [],
          page_context: data.page_context,
        };
      } catch (error) {
        console.error('Error fetching customer credit notes:', error);
        return {
          data: [],
          page_context: {
            page: 1,
            per_page: perPage,
            has_more_page: false,
            total: 0,
            total_pages: 0,
          },
        };
      }
    },
    [`credit-notes-${customerId}-${page}`],
    {
      revalidate: 120, // 2 minutes
      tags: [CACHE_TAGS.CREDIT_NOTES(customerId)],
    }
  );

  return getCachedCreditNotes();
}

// Get single credit note by ID
export async function getCreditNote(
  creditNoteId: string,
  customerId: string
): Promise<ZohoCreditNote | null> {
  const getCachedCreditNote = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoCreditNoteResponse>(`/creditnotes/${creditNoteId}`)
        );

        return data.creditnote || null;
      } catch (error) {
        console.error('Error fetching credit note:', error);
        return null;
      }
    },
    [`credit-note-${creditNoteId}`],
    {
      revalidate: 120,
      tags: [CACHE_TAGS.CREDIT_NOTES(customerId)],
    }
  );

  return getCachedCreditNote();
}

// Get available credit balance
export async function getAvailableCreditBalance(
  customerId: string
): Promise<number> {
  const getCachedBalance = unstable_cache(
    async () => {
      try {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoCreditNotesResponse>('/creditnotes', {
            params: {
              customer_id: customerId,
              status: 'open',
              per_page: 100,
            },
          })
        );

        const creditNotes = data.creditnotes || [];
        return creditNotes.reduce((sum, cn) => sum + cn.balance, 0);
      } catch (error) {
        console.error('Error calculating credit balance:', error);
        return 0;
      }
    },
    [`credit-balance-${customerId}`],
    {
      revalidate: 300,
      tags: [CACHE_TAGS.CREDIT_NOTES(customerId)],
    }
  );

  return getCachedBalance();
}

// Credit note status mapping
export const CREDIT_NOTE_STATUS_MAP: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'gray' },
  open: { label: 'Open', color: 'blue' },
  closed: { label: 'Closed', color: 'green' },
  void: { label: 'Void', color: 'gray' },
};
