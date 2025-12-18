import { NextRequest, NextResponse } from 'next/server';
import { zohoFetch, rateLimitedFetch } from '@/lib/zoho/client';

// Debug endpoint to test Zoho order creation
// Usage: GET /api/debug/order-test?customer_id=XXX&item_id=YYY&rate=ZZZ&secret=tsh-debug-2024

const MAIN_WAREHOUSE_LOCATION_ID = '2646610000000077024';

interface ZohoOrderResponse {
  salesorder: {
    salesorder_id: string;
    salesorder_number: string;
  };
  code?: number;
  message?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Security check
  if (secret !== 'tsh-debug-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customerId = searchParams.get('customer_id');
  const itemId = searchParams.get('item_id');
  const rate = searchParams.get('rate');
  const dryRun = searchParams.get('dry_run') !== 'false'; // Default to dry run

  if (!customerId || !itemId || !rate) {
    return NextResponse.json({
      error: 'Missing required params',
      usage: '/api/debug/order-test?customer_id=XXX&item_id=YYY&rate=ZZZ&secret=tsh-debug-2024&dry_run=false',
      params: {
        customer_id: 'Zoho contact ID',
        item_id: 'Zoho item ID',
        rate: 'Item price',
        dry_run: 'Set to false to actually create order (default: true)',
      }
    }, { status: 400 });
  }

  const orderBody = {
    customer_id: customerId,
    line_items: [{
      item_id: itemId,
      quantity: 1,
      rate: parseFloat(rate),
      location_id: MAIN_WAREHOUSE_LOCATION_ID,
    }],
    notes: 'DEBUG TEST ORDER - Please delete',
    reference_number: `DEBUG-${Date.now()}`,
  };

  if (dryRun) {
    return NextResponse.json({
      status: 'dry_run',
      message: 'This is what would be sent to Zoho (add dry_run=false to actually create)',
      endpoint: 'POST /salesorders (Inventory API)',
      body: orderBody,
      warehouse_info: {
        location_id: MAIN_WAREHOUSE_LOCATION_ID,
        name: 'Main WareHouse',
      }
    });
  }

  // Actually create the order
  try {
    console.log('[order-test] Creating test order:', JSON.stringify(orderBody, null, 2));

    const response = await rateLimitedFetch(() =>
      zohoFetch<ZohoOrderResponse>('/salesorders', {
        method: 'POST',
        api: 'inventory',
        body: orderBody,
      })
    );

    return NextResponse.json({
      status: 'success',
      message: 'Order created successfully!',
      order: response.salesorder,
      note: 'Remember to delete this test order from Zoho',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[order-test] Failed:', errorMessage);

    // Try to parse Zoho error
    let zohoError = null;
    try {
      const match = errorMessage.match(/Zoho API error \(\d+\): (.+)/);
      if (match) {
        zohoError = JSON.parse(match[1]);
      }
    } catch {
      // ignore parse error
    }

    return NextResponse.json({
      status: 'error',
      message: errorMessage,
      zohoError,
      requestBody: orderBody,
    }, { status: 500 });
  }
}
