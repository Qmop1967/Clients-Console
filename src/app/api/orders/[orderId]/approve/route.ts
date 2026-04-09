import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { approveQuotation } from '@/lib/odoo/orders';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.odooPartnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId: orderIdStr } = await params;
    const orderId = parseInt(orderIdStr, 10);
    const partnerId = parseInt(session.user.odooPartnerId, 10);

    if (isNaN(orderId) || isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const result = await approveQuotation(orderId, partnerId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      needsAdminApproval: result.needsAdminApproval,
      message: result.needsAdminApproval
        ? 'Quotation approved. Waiting for admin approval.'
        : 'Quotation approved and confirmed.',
    });
  } catch (error) {
    console.error('[Approve API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
