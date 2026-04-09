import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/odoo/client';

export async function GET() {
  try {
    const uid = await authenticate();
    return NextResponse.json({
      status: 'ok',
      odoo: uid ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      odoo: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
