// ============================================
// TSH Clients Console - Semantic Search API
// AI-powered product search endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { searchProducts, getRecommendations } from '@/lib/ai/vector-search';
import { prepareQueryForSearch, extractProductIntent } from '@/lib/ai/dialect-normalizer';
import { getProduct } from '@/lib/zoho/products';
import { getUnifiedStock } from '@/lib/zoho/stock-cache';
import { auth } from '@/lib/auth/auth';
import { PRICE_LIST_IDS } from '@/lib/zoho/price-lists';

// ============================================
// Configuration
// ============================================

const AI_ENABLED = process.env.AI_ENABLED !== 'false';

// ============================================
// POST /api/ai/search
// Semantic product search
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check if AI is enabled
    if (!AI_ENABLED) {
      return NextResponse.json(
        { error: 'AI assistant is currently disabled' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { query, filters, topK = 10, type = 'search' } = body;

    if (!query && type === 'search') {
      return NextResponse.json(
        { error: 'Query is required for search' },
        { status: 400 }
      );
    }

    console.log(`🔍 AI Search: "${query}" (type: ${type})`);

    // Get authentication context
    const session = await auth();
    const priceListId = session?.user?.priceListId || PRICE_LIST_IDS.CONSUMER;

    let results;

    switch (type) {
      case 'search': {
        // Prepare query (normalize Iraqi dialect + enhance with English)
        const preparedQuery = prepareQueryForSearch(query);

        // Extract intent for better results
        const intent = extractProductIntent(query);
        console.log(`📊 Detected intent:`, intent);

        // Perform vector search
        const searchResults = await searchProducts(preparedQuery, filters, topK);

        // Fetch full product details with stock and pricing
        const detailedResults = await Promise.all(
          searchResults.map(async (result) => {
            try {
              // Fetch full product data
              const product = await getProduct(result.item.item_id);

              if (!product) {
                return null;
              }

              // Get stock
              const stock = await getUnifiedStock(result.item.item_id);

              // Get pricing (simplified - full implementation would fetch from price list)
              // For Phase 1, we'll use the base rate
              const price = product.rate;

              return {
                ...product,
                available_stock: stock,
                display_price: price,
                similarity_score: result.score,
              };
            } catch (error) {
              console.error(`Failed to fetch product ${result.item.item_id}:`, error);
              return null;
            }
          })
        );

        // Filter out null results and apply stock filter if needed
        results = detailedResults
          .filter((p) => p !== null)
          .filter((p) => {
            if (filters?.inStockOnly) {
              return (p!.available_stock?.stock || 0) > 0;
            }
            return true;
          });

        break;
      }

      case 'recommendations': {
        const { itemId } = body;

        if (!itemId) {
          return NextResponse.json(
            { error: 'itemId is required for recommendations' },
            { status: 400 }
          );
        }

        // Get similar products
        const recommendations = await getRecommendations(itemId, topK);

        // Fetch full product details
        const detailedResults = await Promise.all(
          recommendations.map(async (result) => {
            try {
              const product = await getProduct(result.item.item_id);

              if (!product) {
                return null;
              }

              const stock = await getUnifiedStock(result.item.item_id);

              return {
                ...product,
                available_stock: stock,
                display_price: product.rate,
                similarity_score: result.score,
              };
            } catch (error) {
              console.error(`Failed to fetch product ${result.item.item_id}:`, error);
              return null;
            }
          })
        );

        results = detailedResults.filter((p) => p !== null);

        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown search type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
      query: query || undefined,
      priceListId,
    });
  } catch (error) {
    console.error('❌ AI Search error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
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
export const maxDuration = 60; // 1 minute
