// ============================================
// Product Classification API
// ============================================
// Endpoints for AI-powered product classification
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { classifyProduct, classifyProducts, isClassifierConfigured } from '@/lib/ai/classifier';
import {
  getAllCachedClassifications,
  getCacheStats,
  getCachedClassification,
} from '@/lib/ai/category-cache';
import {
  buildCategoryTreeWithCounts,
  convertToTreeData,
  CATEGORY_HIERARCHY,
} from '@/lib/ai/categories';

// Secret for protected endpoints
const CLASSIFY_SECRET = process.env.CLASSIFY_SECRET || 'tsh-classify-2024';

// Maximum execution time (5 minutes for batch operations)
export const maxDuration = 300;

// GET: Get classification for a product or category tree
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'tree';
  const itemId = searchParams.get('item_id');
  const locale = (searchParams.get('locale') as 'en' | 'ar') || 'en';

  try {
    // Action: tree - Get category tree with product counts
    if (action === 'tree') {
      const classifications = await getAllCachedClassifications();
      const tree = buildCategoryTreeWithCounts(classifications);
      const treeData = convertToTreeData(tree, locale);

      return NextResponse.json({
        success: true,
        data: {
          tree: treeData,
          categories: tree,
          total_classified: classifications.length,
        },
      });
    }

    // Action: hierarchy - Get raw category hierarchy (no product counts)
    if (action === 'hierarchy') {
      return NextResponse.json({
        success: true,
        data: CATEGORY_HIERARCHY,
      });
    }

    // Action: stats - Get cache statistics
    if (action === 'stats') {
      const stats = await getCacheStats();
      return NextResponse.json({
        success: true,
        data: {
          ...stats,
          classifier_configured: isClassifierConfigured(),
        },
      });
    }

    // Action: item - Get classification for a specific item
    if (action === 'item' && itemId) {
      const classification = await getCachedClassification(itemId);
      if (!classification) {
        return NextResponse.json(
          { success: false, error: 'Classification not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: classification });
    }

    // Action: all - Get all classifications
    if (action === 'all') {
      const classifications = await getAllCachedClassifications();
      return NextResponse.json({
        success: true,
        data: classifications,
        count: classifications.length,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: tree, hierarchy, stats, item, all' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Classify API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Classify a single product or batch of products
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');
  const action = searchParams.get('action') || 'single';

  // Verify secret for classification operations
  if (secret !== CLASSIFY_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide correct secret.' },
      { status: 401 }
    );
  }

  // Check if classifier is configured
  if (!isClassifierConfigured()) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    // Action: single - Classify a single product
    if (action === 'single') {
      const { item_id, name, description, image_url, category_id, category_name } = body;

      if (!item_id || !name) {
        return NextResponse.json(
          { error: 'item_id and name are required' },
          { status: 400 }
        );
      }

      const classification = await classifyProduct(
        item_id,
        name,
        description,
        image_url,
        { id: category_id, name: category_name }
      );

      return NextResponse.json({ success: true, data: classification });
    }

    // Action: batch - Classify multiple products
    if (action === 'batch') {
      const { products, batch_size = 5, delay_ms = 1000 } = body;

      if (!products || !Array.isArray(products)) {
        return NextResponse.json(
          { error: 'products array is required' },
          { status: 400 }
        );
      }

      const startTime = Date.now();
      const classifications = await classifyProducts(products, {
        batchSize: batch_size,
        delayMs: delay_ms,
      });

      return NextResponse.json({
        success: true,
        data: classifications,
        stats: {
          total: products.length,
          classified: classifications.length,
          duration_ms: Date.now() - startTime,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: single, batch' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Classify API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
