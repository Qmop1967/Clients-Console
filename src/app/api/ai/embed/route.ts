// ============================================
// TSH Clients Console - Embeddings Generation API
// Generates and stores product embeddings
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getAllProductsComplete } from '@/lib/zoho/products';
import {
  indexProducts,
  indexProduct,
  getIndexStats,
  clearIndex,
} from '@/lib/ai/vector-search';

// ============================================
// Configuration
// ============================================

// Protect this endpoint with a secret
const EMBED_SECRET = process.env.EMBED_SECRET || 'tsh-embed-2024';

// ============================================
// POST /api/ai/embed
// Generate embeddings for products
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== EMBED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action = 'index-all', itemId, clear = false } = body;

    console.log(`📦 Embedding API: action=${action}`);

    // Clear index if requested
    if (clear) {
      await clearIndex();
      console.log('✅ Vector index cleared');
    }

    switch (action) {
      case 'index-all': {
        // Fetch all active products from Zoho
        console.log('📥 Fetching all products from Zoho...');
        const products = await getAllProductsComplete();

        console.log(`📊 Found ${products.length} products to index`);

        // Index products in batches
        const result = await indexProducts(products, 10);

        return NextResponse.json({
          success: true,
          message: `Indexed ${result.success} products (${result.failed} failed)`,
          stats: {
            totalProducts: products.length,
            indexed: result.success,
            failed: result.failed,
          },
        });
      }

      case 'index-one': {
        if (!itemId) {
          return NextResponse.json(
            { error: 'itemId required for index-one action' },
            { status: 400 }
          );
        }

        // Fetch single product
        const { getProduct } = await import('@/lib/zoho/products');
        const product = await getProduct(itemId);

        if (!product) {
          return NextResponse.json(
            { error: `Product ${itemId} not found` },
            { status: 404 }
          );
        }

        // Index single product
        await indexProduct(product);

        return NextResponse.json({
          success: true,
          message: `Indexed product: ${product.name}`,
          product: {
            item_id: product.item_id,
            name: product.name,
            sku: product.sku,
          },
        });
      }

      case 'stats': {
        // Get index statistics
        const stats = await getIndexStats();

        return NextResponse.json({
          success: true,
          stats: {
            totalVectors: stats.totalVectors,
            dimension: stats.dimension,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Embedding API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate embeddings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/ai/embed
// Get index statistics
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== EMBED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get index statistics
    const stats = await getIndexStats();

    return NextResponse.json({
      success: true,
      stats: {
        totalVectors: stats.totalVectors,
        dimension: stats.dimension,
        status: stats.totalVectors > 0 ? 'ready' : 'empty',
      },
    });
  } catch (error) {
    console.error('❌ Embedding stats error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get index stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// Edge Runtime Configuration
// ============================================

export const runtime = 'nodejs'; // OpenAI SDK requires Node.js runtime
export const maxDuration = 300; // 5 minutes for large batch indexing
