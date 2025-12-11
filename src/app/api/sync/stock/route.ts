// ============================================
// Stock Sync API Route
// ============================================
// Triggers warehouse stock sync to Redis cache
// Protected with secret key
// Can be called manually or via Vercel Cron
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { syncWholesaleStock, syncStockFromBooks, getStockCacheStatus, isStockCacheStale } from '@/lib/zoho/stock-cache';

// Use environment variable for secret, with fallback for local development
const SYNC_SECRET = process.env.STOCK_SYNC_SECRET || 'tsh-stock-sync-2024';

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
      // Get sync parameters
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      // DEFAULT to 'books' - Books API has higher rate limits AND returns warehouse-specific stock
      const source = searchParams.get('source') || 'books';

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

      // Use Books API for warehouse-specific sync (higher rate limits: ~100 req/min vs ~3750/day)
      // Books API /items/{id} returns locations array with warehouse-specific stock!
      if (source === 'books') {
        console.log(`🚀 Starting warehouse-specific stock sync via Books API (offset=${offset}, limit=${limit})...`);

        const result = await syncStockFromBooks({
          batchSize: 10,
          delayMs: 500,
          maxItems: limit,
          offset: offset,
        });

        const status = await getStockCacheStatus();

        return NextResponse.json({
          success: result.success,
          source: 'books',
          result: {
            itemsProcessed: result.itemsProcessed,
            itemsWithStock: result.itemsWithStock,
            errors: result.errors,
            durationSeconds: Math.round(result.durationMs / 1000),
            totalItems: result.totalItems,
            nextOffset: result.nextOffset,
          },
          cacheStatus: status,
          nextSyncUrl: result.nextOffset
            ? `/api/sync/stock?action=sync&secret=${SYNC_SECRET}&source=books&offset=${result.nextOffset}&limit=${limit}`
            : null,
        });
      }

      // Default: Use Inventory API (slower but warehouse-specific stock)
      console.log(`📦 Starting stock sync via Inventory API (offset=${offset}, limit=${limit})...`);

      const result = await syncWholesaleStock({
        batchSize: 5,
        delayMs: 500,
        maxItems: limit,
        offset: offset,
        skipLock: isChunkedSync,
      });

      const status = await getStockCacheStatus();

      return NextResponse.json({
        success: result.success,
        source: 'inventory',
        result: {
          itemsProcessed: result.itemsProcessed,
          errors: result.errors,
          durationSeconds: Math.round(result.durationMs / 1000),
          totalItems: result.totalItems,
          nextOffset: result.nextOffset,
        },
        cacheStatus: status,
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

    // Run sync using Books API (warehouse-specific via locations array)
    const result = await syncStockFromBooks({
      batchSize: 8,
      delayMs: 1000,
    });

    const status = await getStockCacheStatus();

    console.log(`✅ Cron stock sync complete: ${result.itemsProcessed} items`);

    return NextResponse.json({
      success: result.success,
      source: 'books',
      result: {
        itemsProcessed: result.itemsProcessed,
        itemsWithStock: result.itemsWithStock,
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
