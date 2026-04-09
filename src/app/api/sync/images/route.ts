// ============================================
// Image Sync API Route (Odoo)
// ============================================
// In Odoo, product images are served directly via /web/image/ controller
// No sync or blob caching needed
// ============================================

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Images are served directly from Odoo via /web/image/ endpoint. No sync needed.',
  });
}
