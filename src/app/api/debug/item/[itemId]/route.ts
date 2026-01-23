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

    return NextResponse.json({
      success: true,
      itemId,
      data,
      customFields: data.item?.custom_fields || null,
      hasCustomFields: !!data.item?.custom_fields,
      customFieldsCount: data.item?.custom_fields?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
