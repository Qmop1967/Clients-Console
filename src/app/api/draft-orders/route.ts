import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getDraftOrdersForMerge } from '@/lib/odoo/orders';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.odooPartnerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const drafts = await getDraftOrdersForMerge(session.user.odooPartnerId);

    return NextResponse.json({ success: true, drafts });
  } catch (error) {
    console.error('[Draft Orders API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft orders' },
      { status: 500 }
    );
  }
}
