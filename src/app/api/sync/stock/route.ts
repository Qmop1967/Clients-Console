// ============================================
// Stock Sync API Route (Odoo)
// ============================================
// In Odoo, stock is read directly from stock.quant - no sync needed
// This endpoint returns current stock status
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getAllStock } from '@/lib/odoo/stock';

export async function GET(request: NextRequest) {
  try {
    const stockMap = await getAllStock();

    return NextResponse.json({
      success: true,
      source: 'odoo',
      itemCount: stockMap.size,
      message: 'Stock is read directly from Odoo - no sync needed',
    });
  } catch (error) {
    console.error('Stock API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'Stock is read directly from Odoo in real-time. No sync required.',
  });
}
