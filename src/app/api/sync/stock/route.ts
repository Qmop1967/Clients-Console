// ============================================
// Stock Sync API Route
// ============================================
// Triggers warehouse stock sync to Redis cache
// Protected with secret key
// Can be called manually or via Vercel Cron
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { syncWholesaleStock, getStockCacheStatus, isStockCacheStale } from '@/lib/zoho/stock-cache';

const SYNC_SECRET = 'tsh-stock-sync-2024';

// Maximum execution time for Vercel serverless functions
// Hobby: 10s, Pro: 60s, Enterprise: 900s
// Using 300s (5 minutes) as safe limit for stock sync
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');
  const action = searchParams.get('action') || 'status';
  const force = searchParams.get('force') === 'true';

  // Verify secret for sync operations
  if (action === 'sync' && secret !== SYNC_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide correct secret.' },
      { status: 401 }
    );
  }

  try {
    // Action: status - Get current cache status
    if (action === 'status') {
      const status = await getStockCacheStatus();
      return NextResponse.json({
        success: true,
        cacheStatus: status,
        message: status.exists
          ? `Cache has ${status.itemCount} items, ${status.ageSeconds}s old`
          : 'No stock cache exists',
      });
    }

    // Action: sync - Trigger stock sync (supports chunked sync)
    if (action === 'sync') {
      // Get chunked sync parameters
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const limit = parseInt(searchParams.get('limit') || '100', 10); // Default 100 items per chunk

      // Check if sync is needed (unless force=true or doing chunked sync)
      const isChunkedSync = offset > 0;
      if (!force && !isChunkedSync) {
        const isStale = await isStockCacheStale(15 * 60 * 1000); // 15 minutes
        if (!isStale) {
          const status = await getStockCacheStatus();
          return NextResponse.json({
            success: true,
            skipped: true,
            message: `Cache is fresh (${status.ageSeconds}s old). Use force=true to override.`,
            cacheStatus: status,
          });
        }
      }

      console.log(`📦 Starting stock sync via API (offset=${offset}, limit=${limit})...`);

      // Run sync with chunked settings to avoid timeout
      const result = await syncWholesaleStock({
        batchSize: 5,       // 5 items per batch (reduced for reliability)
        delayMs: 500,       // 0.5s between batches
        maxItems: limit,    // Process chunk of items
        offset: offset,     // Starting position
        skipLock: isChunkedSync, // Skip lock for chunked sync
      });

      const status = await getStockCacheStatus();

      return NextResponse.json({
        success: result.success,
        result: {
          itemsProcessed: result.itemsProcessed,
          errors: result.errors,
          durationSeconds: Math.round(result.durationMs / 1000),
          totalItems: result.totalItems,
          nextOffset: result.nextOffset,
        },
        cacheStatus: status,
        // Include next URL for easy continuation
        nextSyncUrl: result.nextOffset
          ? `/api/sync/stock?action=sync&secret=${SYNC_SECRET}&offset=${result.nextOffset}&limit=${limit}`
          : null,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use action=status or action=sync' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Stock sync API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST handler for Vercel Cron (requires CRON_SECRET header)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Verify Vercel Cron secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized cron request' },
      { status: 401 }
    );
  }

  console.log('📦 Stock sync triggered by Vercel Cron');

  try {
    // Check if cache is stale before syncing
    const isStale = await isStockCacheStale(20 * 60 * 1000); // 20 minutes

    if (!isStale) {
      const status = await getStockCacheStatus();
      console.log(`✅ Stock cache is fresh (${status.ageSeconds}s old), skipping sync`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Cache is fresh, sync skipped',
        cacheStatus: status,
      });
    }

    // Run sync with conservative settings
    const result = await syncWholesaleStock({
      batchSize: 8,
      delayMs: 1500,
    });

    const status = await getStockCacheStatus();

    console.log(`✅ Cron stock sync complete: ${result.itemsProcessed} items`);

    return NextResponse.json({
      success: result.success,
      result: {
        itemsProcessed: result.itemsProcessed,
        errors: result.errors,
        durationSeconds: Math.round(result.durationMs / 1000),
      },
      cacheStatus: status,
    });

  } catch (error) {
    console.error('Cron stock sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
