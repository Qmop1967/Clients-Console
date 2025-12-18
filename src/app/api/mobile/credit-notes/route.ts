// ============================================
// Mobile Credit Notes API
// GET /api/mobile/credit-notes
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getCustomerCreditNotes, getAvailableCreditBalance } from '@/lib/zoho/credit-notes';

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

    // Fetch credit notes and available balance
    const [creditNotesData, availableBalance] = await Promise.all([
      getCustomerCreditNotes(user.zohoContactId, page, perPage),
      getAvailableCreditBalance(user.zohoContactId),
    ]);

    if (!creditNotesData) {
      return mobileError(
        'FETCH_FAILED',
        'Failed to load credit notes',
        'فشل تحميل الإشعارات الدائنة',
        500
      );
    }

    const creditNotes = creditNotesData.data || [];

    // Transform credit notes for mobile
    const transformedCreditNotes = creditNotes.map((cn: { creditnote_id: string; creditnote_number: string; date: string; status: string; total: number; balance?: number; currency_code?: string; reference_number?: string }) => ({
      id: cn.creditnote_id,
      number: cn.creditnote_number,
      date: cn.date,
      status: cn.status,
      total: cn.total,
      balance: cn.balance || 0,
      currency: cn.currency_code || user.currencyCode,
      reference: cn.reference_number || null,
    }));

    return mobileSuccess({
      credit_notes: transformedCreditNotes,
      available_balance: availableBalance || 0,
      currency: user.currencyCode,
    }, {
      page: creditNotesData.page_context?.page || page,
      per_page: creditNotesData.page_context?.per_page || perPage,
      total_items: creditNotesData.page_context?.total || creditNotes.length,
      total_pages: creditNotesData.page_context?.total_pages || 1,
      has_more: creditNotesData.page_context?.has_more_page || false,
    });

  } catch (error) {
    console.error('[Mobile Credit Notes] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load credit notes',
      'فشل تحميل الإشعارات الدائنة',
      500
    );
  }
}
