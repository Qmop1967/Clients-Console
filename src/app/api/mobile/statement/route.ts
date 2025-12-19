// ============================================
// Mobile Account Statement API
// GET /api/mobile/statement
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getAccountStatement } from '@/lib/zoho/statements';

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

    // Get query parameters for date filtering
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;

    // Fetch account statement
    const statementData = await getAccountStatement(user.zohoContactId, startDate, endDate);

    if (!statementData) {
      return mobileError(
        'FETCH_FAILED',
        'Failed to load account statement',
        'فشل تحميل كشف الحساب',
        500
      );
    }

    // Transform transactions for mobile
    const transformedTransactions = statementData.transactions.map((tx) => ({
      id: tx.transaction_id,
      date: tx.date,
      type: tx.transaction_type,
      number: tx.transaction_number,
      description: tx.description,
      debit: tx.debit,
      credit: tx.credit,
      balance: tx.balance,
    }));

    return mobileSuccess({
      transactions: transformedTransactions,
      summary: {
        opening_balance: statementData.opening_balance,
        closing_balance: statementData.closing_balance,
        total_debits: statementData.total_debits,
        total_credits: statementData.total_credits,
        start_date: statementData.from_date,
        end_date: statementData.to_date,
      },
      currency: statementData.currency_code,
    });

  } catch (error) {
    console.error('[Mobile Statement] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load account statement',
      'فشل تحميل كشف الحساب',
      500
    );
  }
}
