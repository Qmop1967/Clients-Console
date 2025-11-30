// ============================================
// Image Sync API Route
// ============================================
// Syncs product images from Zoho to Vercel Blob
// Protected with secret key
// Can be called manually or triggered by webhooks
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/zoho/client';
import {
  syncImages,
  syncSingleImage,
  getSyncStatus,
  updateSyncStatus,
  acquireSyncLock,
  releaseSyncLock,
  getCachedImageUrls,
} from '@/lib/blob/image-cache';
import { getAllProductsComplete } from '@/lib/zoho/products';

const SYNC_SECRET = process.env.IMAGE_SYNC_SECRET || 'tsh-image-sync-2024';

// Maximum execution time (5 minutes for bulk sync)
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');
  const action = searchParams.get('action') || 'status';
  const itemId = searchParams.get('itemId'); // For single item sync
  const limit = parseInt(searchParams.get('limit') || '0'); // Limit items for testing

  // Verify secret for sync operations
  if (action !== 'status' && secret !== SYNC_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide correct secret.' },
      { status: 401 }
    );
  }

  try {
    // Action: status - Get current sync status
    if (action === 'status') {
      const status = await getSyncStatus();
      return NextResponse.json({
        success: true,
        syncStatus: status || { message: 'No sync has been performed yet' },
      });
    }

    // Action: single - Sync a single image
    if (action === 'single' && itemId) {
      console.log(`🖼️ Syncing single image: ${itemId}`);

      const accessToken = await getAccessToken();
      const result = await syncSingleImage(itemId, accessToken);

      return NextResponse.json({
        success: result.success,
        itemId,
        url: result.url,
        error: result.error,
      });
    }

    // Action: sync - Full bulk sync
    if (action === 'sync') {
      // Try to acquire lock
      const lockAcquired = await acquireSyncLock();
      if (!lockAcquired) {
        return NextResponse.json({
          success: false,
          error: 'Another sync is already in progress',
        }, { status: 409 });
      }

      try {
        console.log('🖼️ Starting bulk image sync...');

        // Update status to in progress
        await updateSyncStatus({
          inProgress: true,
          lastSync: Date.now(),
        });

        // Get all products
        const products = await getAllProductsComplete();
        const itemIds = products
          .filter(p => p.image_name || p.image_document_id) // Only items with images
          .map(p => p.item_id);

        // Apply limit if specified (for testing)
        const itemsToSync = limit > 0 ? itemIds.slice(0, limit) : itemIds;

        console.log(`📦 Found ${itemIds.length} products with images, syncing ${itemsToSync.length}`);

        await updateSyncStatus({
          totalImages: itemsToSync.length,
          syncedImages: 0,
          failedImages: 0,
        });

        // Get access token
        const accessToken = await getAccessToken();

        // Sync images with rate limiting
        const result = await syncImages(itemsToSync, accessToken, {
          batchSize: 5,     // 5 images per batch
          delayMs: 1000,    // 1 second between batches
          skipExisting: true, // Don't re-sync cached images
        });

        // Update final status
        await updateSyncStatus({
          inProgress: false,
          syncedImages: result.synced,
          failedImages: result.failed,
        });

        return NextResponse.json({
          success: result.success,
          result: {
            synced: result.synced,
            failed: result.failed,
            skipped: result.skipped,
            duration: `${(result.duration / 1000).toFixed(1)}s`,
          },
          message: result.message,
        });

      } finally {
        await releaseSyncLock();
      }
    }

    // Action: check - Check which images are cached
    if (action === 'check') {
      const products = await getAllProductsComplete();
      const itemIds = products.map(p => p.item_id);
      const cachedUrls = await getCachedImageUrls(itemIds);

      const cached = cachedUrls.size;
      const total = itemIds.length;
      const missing = total - cached;

      return NextResponse.json({
        success: true,
        stats: {
          total,
          cached,
          missing,
          percentage: `${Math.round((cached / total) * 100)}%`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: status, single, sync, or check' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Image sync API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST handler for webhook-triggered syncs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, secret } = body;

    // Verify secret
    if (secret !== SYNC_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds array is required' },
        { status: 400 }
      );
    }

    console.log(`🖼️ Webhook-triggered image sync for ${itemIds.length} items`);

    // Get access token
    const accessToken = await getAccessToken();

    // Sync specific items
    const result = await syncImages(itemIds, accessToken, {
      batchSize: 3,
      delayMs: 500,
      skipExisting: false, // Force re-sync for webhook updates
    });

    return NextResponse.json({
      success: result.success,
      result: {
        synced: result.synced,
        failed: result.failed,
        duration: `${(result.duration / 1000).toFixed(1)}s`,
      },
    });

  } catch (error) {
    console.error('Webhook image sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
