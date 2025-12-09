// ============================================
// Debug Endpoint for Session Data
// ============================================
// Verifies session priceListId matches Zoho pricebook_id
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

const DEBUG_SECRET = process.env.DEBUG_SECRET || 'tsh-debug-2024';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');

  // Verify secret
  if (secret !== DEBUG_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const session = await auth();

    // Fetch fresh Zoho data to compare
    let zohoCustomer = null;
    if (session?.user?.zohoContactId) {
      const { getZohoCustomerFresh } = await import('@/lib/zoho/customers');
      zohoCustomer = await getZohoCustomerFresh(session.user.zohoContactId);
    }

    const sessionPriceListId = session?.user?.priceListId || '';
    const zohoPricebookId = zohoCustomer?.pricebook_id || '';
    const match = sessionPriceListId === zohoPricebookId;

    return NextResponse.json({
      success: true,
      session: {
        email: session?.user?.email || null,
        zohoContactId: session?.user?.zohoContactId || null,
        priceListId: sessionPriceListId,
        currencyCode: session?.user?.currencyCode || null,
        name: session?.user?.name || null,
      },
      zohoFresh: zohoCustomer ? {
        contact_id: zohoCustomer.contact_id,
        contact_name: zohoCustomer.contact_name,
        pricebook_id: zohoPricebookId,
        pricebook_name: zohoCustomer.pricebook_name || null,
        currency_code: zohoCustomer.currency_code,
      } : null,
      analysis: {
        match,
        issue: !match && zohoPricebookId
          ? `Session has "${sessionPriceListId}" but Zoho has "${zohoPricebookId}"`
          : match ? 'Session matches Zoho' : 'No Zoho customer found',
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      error: errorMsg,
    }, { status: 500 });
  }
}
