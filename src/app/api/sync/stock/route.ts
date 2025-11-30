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

    // Action: sync - Trigger full stock sync
    if (action === 'sync') {
      // Check if sync is needed (unless force=true)
      if (!force) {
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

      console.log('📦 Starting stock sync via API...');

      // Run sync with conservative settings to avoid rate limits
      const result = await syncWholesaleStock({
        batchSize: 8,      // 8 items per batch
        delayMs: 1500,     // 1.5s between batches (~5 req/s)
        maxItems: undefined, // Sync all items
      });

      const status = await getStockCacheStatus();

      return NextResponse.json({
        success: result.success,
        result: {
          itemsProcessed: result.itemsProcessed,
          errors: result.errors,
          durationSeconds: Math.round(result.durationMs / 1000),
        },
        cacheStatus: status,
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
