import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

// Receipt tracking is not yet implemented in Odoo
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.odooPartnerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    message: 'Receipt tracking is not yet available.',
  });
}
