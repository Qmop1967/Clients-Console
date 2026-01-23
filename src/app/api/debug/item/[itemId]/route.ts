import { NextRequest, NextResponse } from 'next/server';
import { zohoFetch } from '@/lib/zoho/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

    // Fetch raw item data from Zoho Books
    const data = await zohoFetch<any>(`/items/${itemId}`, {
      api: 'books',
    });

    const item = data.item;

    // Extract minimum quantity field
    const minimumQuantityField = item?.custom_fields?.find(
      (field: any) =>
        field.customfield_id === 'cf_minimum_quantity_limitation' ||
        field.label?.toLowerCase() === 'minimum quantity limitation'
    );

    return NextResponse.json({
      success: true,
      itemId,
      itemName: item?.name,
      itemSku: item?.sku,

      // Minimum Quantity Analysis
      minimumQuantity: {
        customField: minimumQuantityField ? {
          id: minimumQuantityField.customfield_id,
          label: minimumQuantityField.label,
          value: minimumQuantityField.value,
          type: typeof minimumQuantityField.value,
        } : null,
        builtInField: item?.minimum_order_quantity,
        foundInCustomFields: !!minimumQuantityField,
        foundInBuiltIn: !!item?.minimum_order_quantity,
      },

      // Custom Fields Summary
      customFields: {
        hasCustomFields: !!item?.custom_fields,
        count: item?.custom_fields?.length || 0,
        fields: item?.custom_fields || [],
      },

      // Raw response (for debugging)
      rawItem: item,
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
