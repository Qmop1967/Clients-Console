import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { odooSearchRead, odooWrite } from '@/lib/odoo/client';

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

    const body = await request.json();
    const { items, notes } = body;

    // items: [{ product_id, received_qty, note }]

    // Verify the picking belongs to this customer
    const pickings = await odooSearchRead<any>(
      'stock.picking',
      [['id', '=', orderId], ['partner_id', '=', partnerId]],
      ['id', 'name', 'state', 'partner_id']
    );

    if (!pickings.length) {
      return NextResponse.json({ error: 'Delivery not found or access denied' }, { status: 404 });
    }

    const picking = pickings[0];

    // Write delivery confirmation data using custom fields
    try {
      await odooWrite('stock.picking', [orderId], {
        x_client_confirmed: true,
        x_client_confirm_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        x_client_notes: notes || '',
        x_client_items_json: JSON.stringify(items || []),
      });
    } catch {
      // If custom fields don't exist, just mark as confirmed via note
      try {
        const noteText = `[تأكيد استلام العميل - ${new Date().toISOString().split('T')[0]}]\n${notes || 'تم تأكيد الاستلام'}`;
        await odooWrite('stock.picking', [orderId], {
          note: noteText,
        });
      } catch (noteErr) {
        console.error('[DeliveryConfirm] Fallback note write failed:', noteErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery confirmed successfully',
    });
  } catch (error) {
    console.error('[DeliveryConfirm API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
