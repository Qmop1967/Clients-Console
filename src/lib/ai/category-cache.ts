// ============================================
// AI Category Cache - Redis Storage Layer
// ============================================
// Stores AI classifications in Upstash Redis
// TTL: 30 days (classifications rarely change)
// ============================================

import { AIClassification } from './categories';

const REDIS_KEY_PREFIX = 'ai:category:';
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Check if Upstash is configured
function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Get single classification from cache
export async function getCachedClassification(
  itemId: string
): Promise<AIClassification | null> {
  if (!isUpstashConfigured()) {
    console.warn('[AI Cache] Upstash not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${REDIS_KEY_PREFIX}${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.result) {
      return JSON.parse(data.result) as AIClassification;
    }
    return null;
  } catch (error) {
    console.error('[AI Cache] Error getting classification:', error);
    return null;
  }
}

// Save classification to cache
export async function setCachedClassification(
  classification: AIClassification
): Promise<boolean> {
  if (!isUpstashConfigured()) {
    console.warn('[AI Cache] Upstash not configured');
    return false;
  }

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/setex/${REDIS_KEY_PREFIX}${classification.item_id}/${CACHE_TTL_SECONDS}/${encodeURIComponent(JSON.stringify(classification))}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[AI Cache] Error saving classification:', error);
    return false;
  }
}

// Get multiple classifications from cache
export async function getCachedClassifications(
  itemIds: string[]
): Promise<Map<string, AIClassification>> {
  const results = new Map<string, AIClassification>();

  if (!isUpstashConfigured() || itemIds.length === 0) {
    return results;
  }

  try {
    // Use MGET for batch fetching
    const keys = itemIds.map((id) => `${REDIS_KEY_PREFIX}${id}`);
    const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['MGET', ...keys]),
    });

    if (!response.ok) return results;

    const data = await response.json();
    if (data.result && Array.isArray(data.result)) {
      data.result.forEach((value: string | null, index: number) => {
        if (value) {
          try {
            const classification = JSON.parse(value) as AIClassification;
            results.set(itemIds[index], classification);
          } catch {
            // Skip invalid JSON
          }
        }
      });
    }
  } catch (error) {
    console.error('[AI Cache] Error getting batch classifications:', error);
  }

  return results;
}

// Save multiple classifications to cache
export async function setCachedClassifications(
  classifications: AIClassification[]
): Promise<number> {
  if (!isUpstashConfigured() || classifications.length === 0) {
    return 0;
  }

  let saved = 0;

  // Use pipeline for batch saving (Upstash REST supports multiple commands)
  try {
    const pipeline: (string | number)[][] = classifications.map((c) => [
      'SETEX',
      `${REDIS_KEY_PREFIX}${c.item_id}`,
      CACHE_TTL_SECONDS,
      JSON.stringify(c),
    ]);

    const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    });

    if (response.ok) {
      const data = await response.json();
      saved = data.length || classifications.length;
    }
  } catch (error) {
    console.error('[AI Cache] Error saving batch classifications:', error);
  }

  return saved;
}

// Delete classification from cache
export async function deleteCachedClassification(itemId: string): Promise<boolean> {
  if (!isUpstashConfigured()) return false;

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/del/${REDIS_KEY_PREFIX}${itemId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[AI Cache] Error deleting classification:', error);
    return false;
  }
}

// Get all classifications (for building category tree)
export async function getAllCachedClassifications(): Promise<AIClassification[]> {
  if (!isUpstashConfigured()) {
    return [];
  }

  try {
    // Get all keys matching pattern
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/keys/${REDIS_KEY_PREFIX}*`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return [];

    const keysData = await response.json();
    const keys = keysData.result as string[];

    if (!keys || keys.length === 0) return [];

    // Fetch all values using MGET
    const mgetResponse = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['MGET', ...keys]),
    });

    if (!mgetResponse.ok) return [];

    const data = await mgetResponse.json();
    const classifications: AIClassification[] = [];

    if (data.result && Array.isArray(data.result)) {
      for (const value of data.result) {
        if (value) {
          try {
            classifications.push(JSON.parse(value) as AIClassification);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    return classifications;
  } catch (error) {
    console.error('[AI Cache] Error getting all classifications:', error);
    return [];
  }
}

// Get cache statistics
export async function getCacheStats(): Promise<{
  total: number;
  configured: boolean;
}> {
  if (!isUpstashConfigured()) {
    return { total: 0, configured: false };
  }

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/keys/${REDIS_KEY_PREFIX}*`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return { total: 0, configured: true };

    const data = await response.json();
    return {
      total: (data.result as string[])?.length || 0,
      configured: true,
    };
  } catch {
    return { total: 0, configured: true };
  }
}
