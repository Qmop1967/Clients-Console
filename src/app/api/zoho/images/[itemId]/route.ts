// ============================================
// Zoho Product Image Proxy API Route
// ============================================
// Optimized with Vercel Blob CDN:
// 1. Check Redis for cached Blob URL
// 2. If found, redirect to CDN (fast, no Zoho API call)
// 3. If not found, fetch from Zoho (fallback)
//
// Cache Strategy (UPDATED 2024-12):
// - Shorter cache TTLs to allow faster image updates
// - URL now includes version hash (?v=xxx) for cache busting
// - When image changes in Zoho, URL changes → cache invalidated
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/zoho/client';
import { getCachedImageUrl, syncSingleImage } from '@/lib/blob/image-cache';

// Use Zoho Inventory API for images (images are stored in Inventory, not Books)
const ZOHO_INVENTORY_URL = 'https://www.zohoapis.com/inventory/v1';

// Cache headers for images
// UPDATED: Shorter TTLs since URLs now include version hash for cache busting
const CDN_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=30',
  // 1 min browser cache, 5 min CDN cache
  // Short TTLs ensure image updates propagate quickly
  // Version hash in URL (?v=xxx) handles cache busting when image changes
};

const PROXY_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=30',
  // 30s browser cache, 2 min CDN cache for proxied images (Zoho API fallback)
  // Very short cache to ensure quick propagation of new images
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const organizationId = process.env.ZOHO_ORGANIZATION_ID;

    if (!itemId || !organizationId) {
      return new NextResponse('Missing parameters', { status: 400 });
    }

    // ============================================
    // STEP 1: Check Vercel Blob cache (via Redis)
    // ============================================
    const cachedBlobUrl = await getCachedImageUrl(itemId);

    if (cachedBlobUrl) {
      // Fetch from CDN and proxy the response (better iOS compatibility)
      // Note: 302 redirects may not work well with iOS AsyncImage
      try {
        const cdnResponse = await fetch(cachedBlobUrl);
        if (cdnResponse.ok) {
          const imageBuffer = await cdnResponse.arrayBuffer();
          const contentType = cdnResponse.headers.get('content-type') || 'image/jpeg';
          return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              ...CDN_CACHE_HEADERS,
            },
          });
        }
      } catch {
        console.warn(`[Image API] CDN fetch failed for ${itemId}, falling back to Zoho`);
      }
    }

    // ============================================
    // STEP 2: Fallback to Zoho API
    // ============================================
    const token = await getAccessToken();

    // Fetch image from Zoho Inventory (images are stored here)
    const imageUrl = `${ZOHO_INVENTORY_URL}/items/${itemId}/image?organization_id=${organizationId}`;

    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });

    if (!response.ok) {
      // Handle 404 (image not found) and 429 (rate limited)
      if (response.status === 404 || response.status === 429) {
        if (response.status === 429) {
          console.warn(`[Image API] Rate limited by Zoho for item: ${itemId}`);
        }
        return new NextResponse(null, {
          status: 302,
          headers: {
            Location: '/images/product-placeholder.svg',
            'Cache-Control': response.status === 429
              ? 'public, max-age=60, s-maxage=60'
              : 'public, max-age=3600, s-maxage=3600',
          },
        });
      }
      console.error(`Zoho image fetch failed: ${response.status}`);
      return new NextResponse('Image not found', { status: 404 });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // ============================================
    // STEP 3: Async sync to Blob (fire-and-forget)
    // ============================================
    // Don't await - let it happen in background
    syncSingleImage(itemId, token).catch(err => {
      console.warn(`[Image API] Background sync failed for ${itemId}:`, err);
    });

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...PROXY_CACHE_HEADERS,
      },
    });
  } catch (error) {
    console.error('Error fetching Zoho image:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
