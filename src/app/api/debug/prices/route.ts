// DEBUG: Test Zoho price list fetching
// Protected by DEBUG_API_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { zohoFetch, rateLimitedFetch } from '@/lib/zoho/client';
import { getAllProductsComplete } from '@/lib/zoho/products';
import { getCustomerPriceList, PRICE_LIST_IDS, getPriceListWithItems } from '@/lib/zoho/price-lists';
import { validateDebugAuth } from '@/lib/auth/debug-auth';

// Direct Zoho API call to test the pricebookrate endpoint
async function directApiTest(itemIds: string[]) {
  try {
    console.log(`🔬 Direct API test: Calling /items/pricebookrate with ${itemIds.length} items`);
    const response = await rateLimitedFetch(() =>
      zohoFetch<{ code: number; message: string; items: Array<{ item_id: string; name: string; pricebook_rate: number }> }>(
        '/items/pricebookrate',
        {
          api: 'books',
          params: {
            pricebook_id: PRICE_LIST_IDS.CONSUMER,
            item_ids: itemIds.join(','),
            sales_or_purchase_type: 'sales',
          },
        }
      )
    );
    console.log(`✅ Direct API response:`, { code: response.code, message: response.message, itemCount: response.items?.length });
    return response;
  } catch (error) {
    console.error(`❌ Direct API error:`, error);
    return { error: String(error) };
  }
}

export async function GET(request: NextRequest) {
  // Require authentication
  const authError = validateDebugAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const testMode = searchParams.get('mode') || 'full';

  try {
    // Step 1: Get sample products
    const allProducts = await getAllProductsComplete();
    console.log(`📦 Got ${allProducts.length} products`);

    // Get just 10 item IDs for testing
    const testItemIds = allProducts.slice(0, 10).map(p => p.item_id);
    console.log(`🔑 Test item IDs:`, testItemIds);

    // Test 1: Direct API call with 10 items
    console.log(`\n📡 Test 1: Direct API call with 10 items...`);
    const directResult = await directApiTest(testItemIds);

    // Test 2: getPriceListWithItems with 10 items
    console.log(`\n📡 Test 2: getPriceListWithItems with 10 items...`);
    const priceListWith10 = await getPriceListWithItems(PRICE_LIST_IDS.CONSUMER, testItemIds);

    // Test 3: Full simulation (only if mode=full)
    let fullResult = null;
    if (testMode === 'full') {
      console.log(`\n📡 Test 3: Full getCustomerPriceList with all ${allProducts.length} items...`);
      const allItemIds = allProducts.map(p => p.item_id);
      const fullPriceList = await getCustomerPriceList(PRICE_LIST_IDS.CONSUMER, allItemIds);
      fullResult = {
        name: fullPriceList?.name,
        currency: fullPriceList?.currency_code,
        pricebook_items_count: fullPriceList?.pricebook_items?.length || 0,
      };
    }

    return NextResponse.json({
      success: true,
      totalProducts: allProducts.length,
      testItemIds,
      directApiResult: {
        code: (directResult as { code?: number }).code,
        message: (directResult as { message?: string }).message,
        itemCount: (directResult as { items?: unknown[] }).items?.length || 0,
        sampleItems: (directResult as { items?: Array<{ item_id: string; name: string; pricebook_rate: number }> }).items?.slice(0, 3),
        error: (directResult as { error?: string }).error,
      },
      priceListWith10Items: {
        name: priceListWith10?.name,
        currency: priceListWith10?.currency_code,
        pricebook_items_count: priceListWith10?.pricebook_items?.length || 0,
        sampleItems: priceListWith10?.pricebook_items?.slice(0, 3),
      },
      fullResult,
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: (error as Error).stack,
    }, { status: 500 });
  }
}
