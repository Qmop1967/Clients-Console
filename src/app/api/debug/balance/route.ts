import { NextResponse } from 'next/server';
import { zohoFetch } from '@/lib/zoho/client';
import { getCustomerBalance } from '@/lib/zoho/customers';

// Debug endpoint to check balance fetching
// Contact ID from the user's session
const TEST_CONTACT_ID = '2646610000049962565';

export async function GET() {
  try {
    // Method 1: Direct Zoho API call
    const directData = await zohoFetch<{ contact: Record<string, unknown> }>(
      `/contacts/${TEST_CONTACT_ID}`
    );

    // Method 2: Using our getCustomerBalance function
    const balanceData = await getCustomerBalance(TEST_CONTACT_ID);

    return NextResponse.json({
      success: true,
      directFromZoho: {
        outstanding_receivable_amount: directData.contact?.outstanding_receivable_amount,
        unused_credits_receivable_amount: directData.contact?.unused_credits_receivable_amount,
        currency_code: directData.contact?.currency_code,
      },
      fromGetCustomerBalance: balanceData,
      comparison: {
        directOutstanding: directData.contact?.outstanding_receivable_amount,
        functionOutstanding: balanceData?.outstanding,
        match: directData.contact?.outstanding_receivable_amount === balanceData?.outstanding,
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
