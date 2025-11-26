// ============================================
// Zoho Product Image Proxy API Route
// Fetches images from Zoho Inventory with OAuth
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/zoho/client';

const ZOHO_INVENTORY_URL = 'https://www.zohoapis.com/inventory/v1';

// Cache headers for images (1 hour)
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
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

    // Get OAuth token
    const token = await getAccessToken();

    // Fetch image from Zoho Inventory
    const imageUrl = `${ZOHO_INVENTORY_URL}/items/${itemId}/image?organization_id=${organizationId}`;

    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });

    if (!response.ok) {
      // Return a transparent 1x1 pixel if image not found
      if (response.status === 404) {
        return new NextResponse(null, {
          status: 302,
          headers: {
            Location: '/images/product-placeholder.png',
          },
        });
      }
      console.error(`Zoho image fetch failed: ${response.status}`);
      return new NextResponse('Image not found', { status: 404 });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...CACHE_HEADERS,
      },
    });
  } catch (error) {
    console.error('Error fetching Zoho image:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
