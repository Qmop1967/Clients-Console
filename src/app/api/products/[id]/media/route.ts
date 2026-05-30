/**
 * Customer-facing product media API proxy.
 * GET /api/products/{id}/media → forwards to gateway with public-only filter.
 *
 * Returns only media that is x_is_public=true and NOT admin-only audience.
 * Strips internal fields (x_ai_prompt, lineage, source) before sending to client.
 *
 * Created: 2026-05-10 (Phase 8 — Customer Gallery)
 */
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
const API_KEY = process.env.API_KEY || '';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id, 10);

  if (!productId || Number.isNaN(productId)) {
    return NextResponse.json(
      { success: false, error: 'invalid_id' },
      { status: 400 }
    );
  }

  if (!API_KEY) {
    console.error('[product-media] API_KEY not configured');
    return NextResponse.json(
      { success: false, error: 'gateway_unconfigured' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `${GATEWAY_URL}/api/product-media/${productId}?public_only=true`,
      {
        headers: { 'x-api-key': API_KEY },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      console.warn('[product-media] gateway non-2xx', { productId, status: res.status });
      return NextResponse.json(
        { success: true, media: [] },
        { status: 200 }
      );
    }

    const data = await res.json();

    const customerSafe = (data.media || [])
      .filter((m: any) => {
        // PIM v1: use canonical visibility with legacy fallback
        if (m.is_visible === false) return false;
        const vis = m.visibility;
        if (vis) return vis === 'client' || vis === 'public';
        // Legacy fallback
        const aud = m.x_audience;
        if (aud) return aud === 'customer' || aud === 'public' || aud === 'rep';
        return m.x_is_public === true;
      })
      .map((m: any) => ({
        id: m.id,
        url: m.x_url,
        thumbnail_url: m.x_thumbnail_url,
        media_type: m.x_media_type,
        category: m.x_media_category,
        name: m.x_name,
        sequence: m.x_sequence ?? 99,
        mime_type: m.x_mime_type,
        file_size_kb: m.x_file_size_kb,
        // PIM v1 canonical fields
        usage: m.usage,
        visibility: m.visibility,
        asset_type: m.asset_type,
        is_main: m.x_is_main === true,
      }))
      .sort((a: any, b: any) => a.sequence - b.sequence);

    return NextResponse.json(
      { success: true, media: customerSafe },
      {
        status: 200,
        headers: {
          // no-store: this DAM media list is what the gallery actually renders;
          // it must reflect set-main/unset-main/delete immediately (no edge cache tail).
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('[product-media] fetch failed', { productId, error: err.message });
    return NextResponse.json(
      { success: true, media: [] },
      { status: 200 }
    );
  }
}
