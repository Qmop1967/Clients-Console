// ============================================
// Image Proxy for Odoo Product Images
// ============================================
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3010';
const API_KEY = process.env.API_KEY || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const size = request.nextUrl.searchParams.get('size') || '256x256';

  try {
    const imageUrl = `${GATEWAY_URL}/api/image/product/${itemId}?size=${size}`;
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'x-api-key': API_KEY },
      cache: 'no-store',
    });

    if (!res.ok) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    const contentType = res.headers.get('Content-Type') || 'image/png';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Reject tiny images (Odoo placeholder is ~6KB PNG or small JPEG)
    // Real product images are typically > 8KB
    if (buffer.length < 1000) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 502,
      headers: { 'Cache-Control': 'no-cache' },
    });
  }
}
