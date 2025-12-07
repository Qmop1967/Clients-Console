// ============================================
// Debug Endpoint for Image Cache
// ============================================
// Allows verifying image cache status and forcing re-sync
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getCachedImageUrl,
  getStoredImageDocId,
  syncSingleImage,
  clearImageCache,
  hasImageChanged,
} from '@/lib/blob/image-cache';
import { getAccessToken } from '@/lib/zoho/client';

const DEBUG_SECRET = process.env.DEBUG_SECRET || 'tsh-debug-2024';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');
  const itemId = searchParams.get('itemId');
  const action = searchParams.get('action') || 'status';
  const newDocId = searchParams.get('docId');

  // Verify secret
  if (secret !== DEBUG_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!itemId) {
    return NextResponse.json({ error: 'itemId required' }, { status: 400 });
  }

  try {
    switch (action) {
      // Get current cache status for an item
      case 'status': {
        const [cachedUrl, storedDocId] = await Promise.all([
          getCachedImageUrl(itemId),
          getStoredImageDocId(itemId),
        ]);

        return NextResponse.json({
          success: true,
          itemId,
          cache: {
            url: cachedUrl,
            docId: storedDocId,
            hasCachedUrl: !!cachedUrl,
            hasStoredDocId: !!storedDocId,
          },
        });
      }

      // Check if image has changed
      case 'check': {
        if (!newDocId) {
          return NextResponse.json({ error: 'docId required for check action' }, { status: 400 });
        }

        const changed = await hasImageChanged(itemId, newDocId);
        const storedDocId = await getStoredImageDocId(itemId);

        return NextResponse.json({
          success: true,
          itemId,
          newDocId,
          storedDocId,
          hasChanged: changed,
        });
      }

      // Clear cache for an item
      case 'clear': {
        await clearImageCache(itemId);
        return NextResponse.json({
          success: true,
          itemId,
          message: 'Cache cleared',
        });
      }

      // Force re-sync an item's image
      case 'sync': {
        const token = await getAccessToken();

        // Clear existing cache first
        await clearImageCache(itemId);

        // Force sync
        const result = await syncSingleImage(itemId, token, {
          force: true,
          imageDocId: newDocId || undefined,
        });

        return NextResponse.json({
          success: result.success,
          itemId,
          result: {
            url: result.url,
            error: result.error,
            unchanged: result.unchanged,
          },
          message: result.success ? 'Image synced successfully' : `Sync failed: ${result.error}`,
        });
      }

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          availableActions: ['status', 'check', 'clear', 'sync'],
        }, { status: 400 });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      error: errorMsg,
    }, { status: 500 });
  }
}
