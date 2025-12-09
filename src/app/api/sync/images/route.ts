// ============================================
// Image Sync API Route
// ============================================
// Syncs product images from Zoho to Vercel Blob
// Detects deleted images and cleans them up
// Protected with secret key
// Can be called manually, via webhooks, or Vercel Cron (daily backup)
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
  deleteImageFromBlob,
  clearImageCache,
  getStoredImageDocId,
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

// POST handler for Vercel Cron (requires CRON_SECRET header) and webhook-triggered syncs
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const contentType = request.headers.get('content-type');

  // Check if this is a Vercel Cron request
  const isCronRequest = authHeader?.startsWith('Bearer ') && cronSecret;

  if (isCronRequest) {
    // Verify Vercel Cron secret
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized cron request' },
        { status: 401 }
      );
    }

    console.log('[ImageSync] Image sync triggered by Vercel Cron');

    try {
      // Try to acquire lock
      const hasLock = await acquireSyncLock();
      if (!hasLock) {
        console.log('[ImageSync] Skipping cron - sync already in progress');
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Sync already in progress',
        });
      }

      try {
        await updateSyncStatus({ inProgress: true, lastSync: Date.now() });

        // Get all products and check for image changes/deletions
        const products = await getAllProductsComplete();
        const accessToken = await getAccessToken();

        let imagesSynced = 0;
        let imagesDeleted = 0;
        let itemsProcessed = 0;
        const errors: string[] = [];

        // Process each product to detect changes and deletions
        for (const product of products) {
          itemsProcessed++;

          const hasImage = !!(product.image_document_id || product.image_name);
          const storedDocId = await getStoredImageDocId(product.item_id);

          // Case 1: Item has image, check if it needs sync
          if (hasImage && product.image_document_id) {
            if (!storedDocId || storedDocId !== product.image_document_id) {
              try {
                const result = await syncSingleImage(product.item_id, accessToken, {
                  force: false,
                  imageDocId: product.image_document_id,
                });
                if (result.success && !result.unchanged) {
                  imagesSynced++;
                  console.log(`[ImageSync] Synced image for ${product.item_id} (${product.sku})`);
                }
              } catch (error) {
                errors.push(`Sync failed for ${product.item_id}`);
              }
            }
          }

          // Case 2: Item has no image but we have cached one - image was deleted
          if (!hasImage && storedDocId) {
            console.log(`[ImageSync] Detected deleted image for ${product.item_id} (${product.sku})`);
            try {
              await deleteImageFromBlob(product.item_id);
              await clearImageCache(product.item_id);
              imagesDeleted++;
            } catch (error) {
              errors.push(`Delete failed for ${product.item_id}`);
            }
          }

          // Small delay every 50 items to avoid overwhelming the API
          if (itemsProcessed % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        await updateSyncStatus({
          inProgress: false,
          syncedImages: imagesSynced,
          failedImages: errors.length,
          totalImages: itemsProcessed,
        });

        console.log(`[ImageSync] Cron sync complete: ${imagesSynced} synced, ${imagesDeleted} deleted, ${errors.length} errors`);

        return NextResponse.json({
          success: errors.length === 0,
          result: {
            itemsProcessed,
            imagesSynced,
            imagesDeleted,
            errorsCount: errors.length,
          },
        });

      } finally {
        await releaseSyncLock();
      }

    } catch (error) {
      console.error('[ImageSync] Cron sync error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  // Handle webhook-triggered syncs (JSON body with itemIds)
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

    console.log(`[ImageSync] Webhook-triggered image sync for ${itemIds.length} items`);

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
    console.error('[ImageSync] Webhook image sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
