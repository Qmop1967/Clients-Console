import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { mergeToDraftOrder } from '@/lib/odoo/orders';
import { z } from 'zod';

export const maxDuration = 60;

const mergeSchema = z.object({
  items: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().positive(),
    rate: z.number().positive(),
    name: z.string(),
  })).min(1, 'At least one item required'),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.odooPartnerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { orderId: id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json();
    const validation = mergeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { items, notes } = validation.data;

    const result = await mergeToDraftOrder({
      orderId,
      customerId: session.user.odooPartnerId,
      items,
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    console.error('[Merge API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to merge items' },
      { status: 500 }
    );
  }
}
