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
  // immutable ONLY when the URL is versioned (?v=). Un-versioned callers (invoices,
  // credit-notes, order-detail) get a short cache so their images still refresh.
  const hasVersion = !!request.nextUrl.searchParams.get('v');
  const isPlaceholder = request.nextUrl.searchParams.get('ph') === '1';

  // Deterministic SVG placeholder for products without a real image.
  // BYPASSES the <1000-byte tiny-image rejection below (that guard is for PNG/JPEG,
  // and a small SVG is legitimate). Always streamed back as 200.
  if (isPlaceholder) {
    try {
      const res = await fetch(
        `${GATEWAY_URL}/api/image/product/${itemId}/placeholder`,
        {
          signal: AbortSignal.timeout(10000),
          headers: { 'x-api-key': API_KEY },
          cache: 'no-store',
        }
      );
      const svg = await res.text();
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch {
      return new NextResponse(null, {
        status: 502,
        headers: { 'Cache-Control': 'no-cache' },
      });
    }
  }

  try {
    // Forward the version (?v=) so the Gateway's Redis cache is version-keyed
    // and product image updates invalidate cleanly.
    const versionParam = request.nextUrl.searchParams.get('v');
    const imageUrl = `${GATEWAY_URL}/api/image/product/${itemId}?size=${size}${versionParam ? `&v=${encodeURIComponent(versionParam)}` : ''}`;
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'x-api-key': API_KEY },
      cache: 'no-store',
    });

    if (!res.ok) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
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
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Versioned URL is immutable -> cache 1yr; un-versioned -> short cache.
        'Cache-Control': hasVersion
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 502,
      headers: { 'Cache-Control': 'no-cache' },
    });
  }
}
