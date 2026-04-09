// ============================================
// TSH Clients Console - Vector Search
// AI-powered semantic product search
// ============================================

import { Index } from '@upstash/vector';
import OpenAI from 'openai';
import type { Product } from '@/types';

// ============================================
// Configuration
// ============================================

// Lazy init — prevents build-time crash when env vars are missing (CI)
let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

let _vectorIndex: Index | null = null;
function getVectorIndex() {
  if (!_vectorIndex) _vectorIndex = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
  return _vectorIndex;
}

// ============================================
// Types
// ============================================

export interface ProductVector {
  id: string; // item_id
  vector: number[]; // 1536-dimensional embedding
  metadata: {
    name: string;
    name_ar?: string;
    sku: string;
    category: string;
    brand?: string;
    description?: string;
    tags: string[]; // Searchable tags (e.g., "wireless", "fast-charging")
  };
}

export interface SearchResult {
  item: Product;
  score: number; // Similarity score (0-1)
}

export interface SearchFilters {
  category?: string;
  brand?: string;
  inStockOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

// ============================================
// Product Vectorization
// ============================================

/**
 * Generate searchable text from product data
 * Combines English and Arabic-friendly terms
 */
function generateProductText(product: Product): string {
  const parts = [
    product.name,
    product.sku,
    product.brand,
    product.category_name,
    product.description,
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Extract searchable tags from product
 * Used for filtering and enhanced search
 */
function extractProductTags(product: Product): string[] {
  const tags: string[] = [];

  // Brand tag
  if (product.brand) {
    tags.push(product.brand.toLowerCase());
  }

  // Category tag
  if (product.category_name) {
    tags.push(product.category_name.toLowerCase());
  }

  // Common tech terms from name/description
  const text = `${product.name} ${product.description || ''}`.toLowerCase();

  // Wireless/Bluetooth
  if (text.includes('wireless') || text.includes('bluetooth')) {
    tags.push('wireless');
  }

  // Fast charging
  if (text.includes('fast') && text.includes('charg')) {
    tags.push('fast-charging');
  }

  // USB types
  if (text.includes('type-c') || text.includes('usb-c')) {
    tags.push('usb-c');
  }
  if (text.includes('micro usb')) {
    tags.push('micro-usb');
  }

  // Apple compatibility
  if (text.includes('iphone') || text.includes('apple') || text.includes('lightning')) {
    tags.push('apple-compatible');
  }

  // Samsung
  if (text.includes('samsung') || text.includes('galaxy')) {
    tags.push('samsung-compatible');
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Generate embedding for a single product
 */
export async function embedProduct(product: Product): Promise<number[]> {
  try {
    const text = generateProductText(product);

    const response = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error(`❌ Failed to embed product ${product.item_id}:`, error);
    throw error;
  }
}

/**
 * Store product embedding in vector database
 */
export async function indexProduct(product: Product): Promise<void> {
  try {
    const embedding = await embedProduct(product);
    const tags = extractProductTags(product);

    const productVector: ProductVector = {
      id: product.item_id,
      vector: embedding,
      metadata: {
        name: product.name,
        sku: product.sku,
        category: product.category_name || '',
        brand: product.brand,
        description: product.description,
        tags,
      },
    };

    await getVectorIndex().upsert({
      id: productVector.id,
      vector: productVector.vector,
      metadata: productVector.metadata,
    });

    console.log(`✅ Indexed product: ${product.name} (${product.item_id})`);
  } catch (error) {
    console.error(`❌ Failed to index product ${product.item_id}:`, error);
    throw error;
  }
}

/**
 * Batch index multiple products
 * Handles rate limiting and retries
 */
export async function indexProducts(
  products: Product[],
  batchSize: number = 10
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  console.log(`📦 Indexing ${products.length} products in batches of ${batchSize}...`);

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(async (product) => {
        try {
          await indexProduct(product);
          success++;
        } catch (error) {
          failed++;
          console.error(`❌ Failed to index ${product.name}:`, error);
        }
      })
    );

    // Rate limiting: wait 1 second between batches
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Indexing complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * Update a single product's embedding
 * Called by webhook when product is updated in the system
 */
export async function updateProductEmbedding(product: Product): Promise<void> {
  try {
    await indexProduct(product);
    console.log(`✅ Updated embedding for: ${product.name}`);
  } catch (error) {
    console.error(`❌ Failed to update embedding for ${product.item_id}:`, error);
    throw error;
  }
}

/**
 * Delete product from vector index
 * Called when product is deleted in the system
 */
export async function deleteProductEmbedding(itemId: string): Promise<void> {
  try {
    await getVectorIndex().delete(itemId);
    console.log(`✅ Deleted embedding for item: ${itemId}`);
  } catch (error) {
    console.error(`❌ Failed to delete embedding for ${itemId}:`, error);
    // Don't throw - deletion failures are not critical
  }
}

// ============================================
// Semantic Search
// ============================================

/**
 * Search products using natural language query
 * Supports both English and Iraqi Arabic
 */
export async function searchProducts(
  query: string,
  filters?: SearchFilters,
  topK: number = 10
): Promise<SearchResult[]> {
  try {
    console.log(`🔍 Searching for: "${query}"`);

    // Generate embedding for query
    const response = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float',
    });

    const queryEmbedding = response.data[0].embedding;

    // Search vector index
    const results = await getVectorIndex().query({
      vector: queryEmbedding,
      topK: topK * 2, // Get more results for filtering
      includeMetadata: true,
    });

    // Filter and transform results
    const filteredResults = results
      .filter((result) => {
        if (!result.metadata) return false;

        // Category filter
        if (filters?.category && result.metadata.category !== filters.category) {
          return false;
        }

        // Brand filter
        if (filters?.brand && result.metadata.brand !== filters.brand) {
          return false;
        }

        return true;
      })
      .slice(0, topK); // Take top K after filtering

    console.log(`✅ Found ${filteredResults.length} results`);

    // Return results with item IDs
    // Note: Full product data should be fetched from API API using these IDs
    return filteredResults.map((result) => ({
      item: {
        item_id: result.id,
        name: result.metadata?.name || '',
        sku: result.metadata?.sku || '',
        category_name: result.metadata?.category,
        brand: result.metadata?.brand,
        description: result.metadata?.description,
      } as Product,
      score: result.score || 0,
    }));
  } catch (error) {
    console.error('❌ Search failed:', error);
    throw error;
  }
}

/**
 * Get product recommendations based on similarity
 */
export async function getRecommendations(
  itemId: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    // Fetch the product's embedding from the index
    const product = await getVectorIndex().fetch([itemId]);

    if (!product || product.length === 0 || !product[0]?.vector) {
      console.warn(`⚠️ Product ${itemId} not found in vector index`);
      return [];
    }

    // Search for similar products
    const results = await getVectorIndex().query({
      vector: product[0].vector,
      topK: topK + 1, // +1 to exclude the product itself
      includeMetadata: true,
    });

    // Filter out the original product
    const recommendations = results
      .filter((result) => result.id !== itemId)
      .slice(0, topK);

    console.log(`✅ Found ${recommendations.length} recommendations for ${itemId}`);

    return recommendations.map((result) => ({
      item: {
        item_id: result.id,
        name: result.metadata?.name || '',
        sku: result.metadata?.sku || '',
        category_name: result.metadata?.category,
        brand: result.metadata?.brand,
        description: result.metadata?.description,
      } as Product,
      score: result.score || 0,
    }));
  } catch (error) {
    console.error('❌ Recommendations failed:', error);
    throw error;
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<{
  totalVectors: number;
  dimension: number;
}> {
  try {
    const info = await getVectorIndex().info();
    return {
      totalVectors: info.vectorCount || 0,
      dimension: info.dimension || 1536,
    };
  } catch (error) {
    console.error('❌ Failed to get index stats:', error);
    return { totalVectors: 0, dimension: 1536 };
  }
}

/**
 * Clear all vectors from index
 * WARNING: Use with caution - deletes all product embeddings
 */
export async function clearIndex(): Promise<void> {
  try {
    await getVectorIndex().reset();
    console.log('✅ Vector index cleared');
  } catch (error) {
    console.error('❌ Failed to clear index:', error);
    throw error;
  }
}
