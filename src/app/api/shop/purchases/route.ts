import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { localeToOdooLang, locales, type Locale } from '@/i18n/config';
import { getCustomerPurchasedProducts } from '@/lib/odoo/purchase-history';
import { PRICE_LIST_IDS } from '@/lib/odoo/pricelists';

export const dynamic = 'force-dynamic';

function privateJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie',
    },
  });
}

/**
 * GET /api/shop/purchases?locale=ar
 *
 * Security boundary: customer and pricelist identifiers come exclusively from
 * the authenticated server session. The route never accepts a customer_id from
 * the browser, preventing cross-account purchase-history access.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const customerId = session?.user?.odooPartnerId;

  if (!session?.user || !customerId) {
    return privateJson(
      { error: 'AUTH_REQUIRED', message: 'Authentication is required.' },
      { status: 401 }
    );
  }

  const requestedLocale = request.nextUrl.searchParams.get('locale') || 'ar';
  const locale = locales.includes(requestedLocale as Locale)
    ? requestedLocale as Locale
    : 'ar';
  const odooLang = localeToOdooLang(locale);
  // Mirror the shop's established fallback. Never expose product.list_price.
  const pricelistId = session.user.priceListId || PRICE_LIST_IDS.CONSUMER;

  try {
    const result = await getCustomerPurchasedProducts(
      customerId,
      pricelistId,
      odooLang
    );
    return privateJson(result);
  } catch (error) {
    console.error('[Purchase History API] Failed:', error);
    return privateJson(
      { error: 'PURCHASE_HISTORY_UNAVAILABLE', message: 'Purchase history is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
