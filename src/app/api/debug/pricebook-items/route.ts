// ============================================
// Debug Endpoint for Pricebook Items
// ============================================
// Checks if a pricebook has items/prices configured
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/zoho/client';
import { PRICE_LIST_IDS, PRICE_LIST_INFO } from '@/lib/zoho/price-lists';

const DEBUG_SECRET = process.env.DEBUG_SECRET || 'tsh-debug-2024';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');
  const pricebookId = searchParams.get('pricebookId') || PRICE_LIST_IDS.WHOLESALE_A_IQD;
  const sampleItemId = searchParams.get('itemId') || '2646610000004140367'; // Sample item

  // Verify secret
  if (secret !== DEBUG_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = await getAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID || '748369814';

    // Method 1: Get pricebook details (includes item count)
    const pricebookResponse = await fetch(
      `https://www.zohoapis.com/books/v3/pricebooks/${pricebookId}?organization_id=${orgId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const pricebookData = pricebookResponse.ok ? await pricebookResponse.json() : { error: `Failed: ${pricebookResponse.status}` };

    // Method 2: Get pricebook rates for a sample item
    const ratesResponse = await fetch(
      `https://www.zohoapis.com/books/v3/items/pricebookrate?organization_id=${orgId}&pricebook_id=${pricebookId}&item_ids=${sampleItemId}&sales_or_purchase_type=sales`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const ratesData = ratesResponse.ok ? await ratesResponse.json() : { error: `Failed: ${ratesResponse.status}` };

    // Method 3: Get item-specific price from pricebook
    const itemPriceResponse = await fetch(
      `https://www.zohoapis.com/books/v3/items/${sampleItemId}?organization_id=${orgId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const itemData = itemPriceResponse.ok ? await itemPriceResponse.json() : { error: `Failed: ${itemPriceResponse.status}` };

    // Get rates for multiple sample items (first 5)
    const sampleItemIds = ['2646610000004140367', '2646610000004140377', '2646610000004140387', '2646610000004140397', '2646610000004140407'];
    const multiRatesResponse = await fetch(
      `https://www.zohoapis.com/books/v3/items/pricebookrate?organization_id=${orgId}&pricebook_id=${pricebookId}&item_ids=${sampleItemIds.join(',')}&sales_or_purchase_type=sales`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const multiRatesData = multiRatesResponse.ok ? await multiRatesResponse.json() : { error: `Failed: ${multiRatesResponse.status}` };

    // Compare with USD pricebook
    const usdPricebookId = PRICE_LIST_IDS.WHOLESALE_A_USD;
    const usdRatesResponse = await fetch(
      `https://www.zohoapis.com/books/v3/items/pricebookrate?organization_id=${orgId}&pricebook_id=${usdPricebookId}&item_ids=${sampleItemIds.join(',')}&sales_or_purchase_type=sales`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const usdRatesData = usdRatesResponse.ok ? await usdRatesResponse.json() : { error: `Failed: ${usdRatesResponse.status}` };

    const pricebook = pricebookData.pricebook || {};
    const iqdItems = multiRatesData.items || [];
    const usdItems = usdRatesData.items || [];

    return NextResponse.json({
      success: true,
      pricebook: {
        id: pricebookId,
        name: pricebook.name,
        currency_code: pricebook.currency_code,
        currency_symbol: pricebook.currency_symbol,
        is_active: pricebook.is_active,
        pricebook_items_count: pricebook.pricebook_items?.length || 0,
      },
      sampleItemRates: {
        pricebook_id: pricebookId,
        items_found: iqdItems.length,
        items: iqdItems.map((item: { item_id: string; name: string; pricebook_rate: number; rate: number }) => ({
          item_id: item.item_id,
          name: item.name,
          pricebook_rate: item.pricebook_rate,
          rate: item.rate,
        })),
      },
      comparison: {
        iqd_pricebook: {
          id: pricebookId,
          name: PRICE_LIST_INFO[pricebookId as keyof typeof PRICE_LIST_INFO]?.name || 'Unknown',
          currency: PRICE_LIST_INFO[pricebookId as keyof typeof PRICE_LIST_INFO]?.currency || 'Unknown',
          items_with_prices: iqdItems.length,
          sample_prices: iqdItems.slice(0, 3).map((i: { name: string; pricebook_rate: number }) => ({ name: i.name, rate: i.pricebook_rate })),
        },
        usd_pricebook: {
          id: usdPricebookId,
          name: PRICE_LIST_INFO[usdPricebookId as keyof typeof PRICE_LIST_INFO]?.name || 'Unknown',
          currency: PRICE_LIST_INFO[usdPricebookId as keyof typeof PRICE_LIST_INFO]?.currency || 'Unknown',
          items_with_prices: usdItems.length,
          sample_prices: usdItems.slice(0, 3).map((i: { name: string; pricebook_rate: number }) => ({ name: i.name, rate: i.pricebook_rate })),
        },
        issue: iqdItems.length === 0
          ? 'IQD PRICEBOOK HAS NO ITEM PRICES - This is the root cause!'
          : iqdItems.length < usdItems.length
            ? 'IQD pricebook has fewer items than USD pricebook'
            : 'Both pricebooks have similar item counts',
      },
      allPriceLists: Object.entries(PRICE_LIST_IDS).map(([key, id]) => ({
        key,
        id,
        info: PRICE_LIST_INFO[id as keyof typeof PRICE_LIST_INFO],
      })),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      error: errorMsg,
    }, { status: 500 });
  }
}
