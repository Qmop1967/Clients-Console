import { NextResponse } from 'next/server';
import { zohoFetch } from '@/lib/zoho/client';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint to see what fields the Zoho Books LIST API returns
 * Compare with detail API to see if custom_fields are included
 */
export async function GET() {
  try {
    // Fetch first page of items from Books LIST API
    const listData = await zohoFetch<any>('/items', {
      api: 'books',
      params: {
        page: 1,
        per_page: 3, // Just get a few items
        filter_by: 'Status.Active',
      },
    });

    const items = listData.items || [];

    // For comparison, fetch one of those items using detail API
    const firstItemId = items[0]?.item_id;
    let detailData = null;

    if (firstItemId) {
      detailData = await zohoFetch<any>(`/items/${firstItemId}`, {
        api: 'books',
      });
    }

    return NextResponse.json({
      success: true,
      test: 'Comparing LIST API vs DETAIL API',
      listApi: {
        endpoint: '/items (list)',
        itemCount: items.length,
        firstItem: items[0] ? {
          item_id: items[0].item_id,
          name: items[0].name,
          sku: items[0].sku,
          hasCustomFields: !!items[0].custom_fields,
          customFieldsCount: items[0].custom_fields?.length || 0,
          customFields: items[0].custom_fields || null,
          minimum_order_quantity: items[0].minimum_order_quantity,
        } : null,
      },
      detailApi: detailData ? {
        endpoint: `/items/${firstItemId} (detail)`,
        item: {
          item_id: detailData.item?.item_id,
          name: detailData.item?.name,
          sku: detailData.item?.sku,
          hasCustomFields: !!detailData.item?.custom_fields,
          customFieldsCount: detailData.item?.custom_fields?.length || 0,
          customFields: detailData.item?.custom_fields || null,
          minimum_order_quantity: detailData.item?.minimum_order_quantity,
        },
      } : null,
      conclusion: 'Compare hasCustomFields between list and detail APIs',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
