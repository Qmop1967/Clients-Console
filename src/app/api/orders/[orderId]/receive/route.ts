import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { updateLineItemReceipt } from '@/lib/zoho/orders';
import { revalidateTag } from 'next/cache';
import { CACHE_TAGS } from '@/lib/zoho/client';

// POST /api/orders/[orderId]/receive
// Update receipt status for a line item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await params;
    const customerId = session.user.zohoContactId;

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID not found' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { lineItemId, quantityReceived } = body;

    if (!lineItemId || !quantityReceived || quantityReceived <= 0) {
      return NextResponse.json(
        { error: 'Invalid request: lineItemId and quantityReceived (> 0) are required' },
        { status: 400 }
      );
    }

    // Update receipt status in Zoho
    const result = await updateLineItemReceipt(
      orderId,
      lineItemId,
      quantityReceived,
      customerId
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update receipt status' },
        { status: 500 }
      );
    }

    // Revalidate order cache
    revalidateTag(CACHE_TAGS.ORDERS(customerId));

    return NextResponse.json({
      success: true,
      message: 'Receipt status updated successfully',
    });
  } catch (error) {
    console.error('[POST /api/orders/[orderId]/receive] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
