// ============================================
// Image Cache - Vercel Blob + Redis URL Mapping
// ============================================
// Strategy:
// 1. Store images in Vercel Blob (CDN-backed, fast delivery)
// 2. Store URL mappings in Upstash Redis (fast lookup)
// 3. Fall back to Zoho API for images not yet synced
// ============================================

import { put, del, list } from '@vercel/blob';

// Redis key prefix for image URLs
const IMAGE_URL_PREFIX = 'image:';
const IMAGE_SYNC_STATUS_KEY = 'image:sync:status';

// ============================================
// TYPES
// ============================================

interface ImageSyncStatus {
  lastSync: number;
  totalImages: number;
  syncedImages: number;
  failedImages: number;
  inProgress: boolean;
}

interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

// ============================================
// UPSTASH REDIS HELPERS
// ============================================

function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisGet(key: string): Promise<string | null> {
  if (!isUpstashConfigured()) return null;

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.warn(`[ImageCache] Redis GET failed for ${key}:`, error);
    return null;
  }
}

async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!isUpstashConfigured()) return false;

  try {
    const url = ttlSeconds
      ? `${process.env.UPSTASH_REDIS_REST_URL}/setex/${key}/${ttlSeconds}/${encodeURIComponent(value)}`
      : `${process.env.UPSTASH_REDIS_REST_URL}/set/${key}/${encodeURIComponent(value)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.warn(`[ImageCache] Redis SET failed for ${key}:`, error);
    return false;
  }
}

async function redisMSet(keyValuePairs: Record<string, string>): Promise<boolean> {
  if (!isUpstashConfigured()) return false;

  try {
    const args = Object.entries(keyValuePairs).flatMap(([k, v]) => [k, v]);

    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['MSET', ...args]),
      }
    );

    return response.ok;
  } catch (error) {
    console.warn('[ImageCache] Redis MSET failed:', error);
    return false;
  }
}

async function redisMGet(keys: string[]): Promise<Map<string, string>> {
  if (!isUpstashConfigured() || keys.length === 0) return new Map();

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['MGET', ...keys]),
      }
    );

    if (!response.ok) return new Map();

    const data = await response.json();
    const result = new Map<string, string>();

    if (Array.isArray(data.result)) {
      data.result.forEach((value: string | null, index: number) => {
        if (value) {
          result.set(keys[index], value);
        }
      });
    }

    return result;
  } catch (error) {
    console.warn('[ImageCache] Redis MGET failed:', error);
    return new Map();
  }
}

// ============================================
// IMAGE URL CACHE (Redis)
// ============================================

/**
 * Get cached Blob URL for a product image
 */
export async function getCachedImageUrl(itemId: string): Promise<string | null> {
  const key = `${IMAGE_URL_PREFIX}${itemId}`;
  return redisGet(key);
}

/**
 * Get cached Blob URLs for multiple products
 */
export async function getCachedImageUrls(itemIds: string[]): Promise<Map<string, string>> {
  const keys = itemIds.map(id => `${IMAGE_URL_PREFIX}${id}`);
  const results = await redisMGet(keys);

  // Convert keys back to item IDs
  const urlMap = new Map<string, string>();
  results.forEach((url, key) => {
    const itemId = key.replace(IMAGE_URL_PREFIX, '');
    urlMap.set(itemId, url);
  });

  return urlMap;
}

/**
 * Cache a Blob URL for a product image
 */
export async function cacheImageUrl(itemId: string, blobUrl: string): Promise<boolean> {
  const key = `${IMAGE_URL_PREFIX}${itemId}`;
  return redisSet(key, blobUrl);
}

/**
 * Cache multiple Blob URLs at once
 */
export async function cacheImageUrls(urlMap: Map<string, string>): Promise<boolean> {
  const keyValuePairs: Record<string, string> = {};
  urlMap.forEach((url, itemId) => {
    keyValuePairs[`${IMAGE_URL_PREFIX}${itemId}`] = url;
  });

  return redisMSet(keyValuePairs);
}

// ============================================
// VERCEL BLOB OPERATIONS
// ============================================

/**
 * Upload an image to Vercel Blob
 */
export async function uploadImageToBlob(
  itemId: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<ImageUploadResult> {
  try {
    // Determine file extension from content type
    const ext = contentType.includes('png') ? 'png' :
                contentType.includes('gif') ? 'gif' :
                contentType.includes('webp') ? 'webp' : 'jpg';

    const filename = `products/${itemId}.${ext}`;

    const blob = await put(filename, imageBuffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false, // Use exact filename for consistent URLs
    });

    console.log(`[ImageCache] Uploaded ${itemId} to Blob: ${blob.url}`);

    // Cache the URL in Redis
    await cacheImageUrl(itemId, blob.url);

    return { success: true, url: blob.url };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ImageCache] Failed to upload ${itemId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Delete an image from Vercel Blob
 */
export async function deleteImageFromBlob(itemId: string): Promise<boolean> {
  try {
    // List blobs with this item ID prefix
    const { blobs } = await list({ prefix: `products/${itemId}` });

    for (const blob of blobs) {
      await del(blob.url);
      console.log(`[ImageCache] Deleted blob: ${blob.url}`);
    }

    return true;
  } catch (error) {
    console.error(`[ImageCache] Failed to delete ${itemId}:`, error);
    return false;
  }
}

// ============================================
// SYNC STATUS TRACKING
// ============================================

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<ImageSyncStatus | null> {
  const data = await redisGet(IMAGE_SYNC_STATUS_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data) as ImageSyncStatus;
  } catch {
    return null;
  }
}

/**
 * Update sync status
 */
export async function updateSyncStatus(status: Partial<ImageSyncStatus>): Promise<boolean> {
  const current = await getSyncStatus() || {
    lastSync: 0,
    totalImages: 0,
    syncedImages: 0,
    failedImages: 0,
    inProgress: false,
  };

  const updated = { ...current, ...status };
  return redisSet(IMAGE_SYNC_STATUS_KEY, JSON.stringify(updated));
}

// ============================================
// SYNC LOCK (Prevent Concurrent Syncs)
// ============================================

const SYNC_LOCK_KEY = 'image:sync:lock';
const SYNC_LOCK_TTL = 600; // 10 minutes

export async function acquireSyncLock(): Promise<boolean> {
  if (!isUpstashConfigured()) return true; // Allow in dev without Redis

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', SYNC_LOCK_KEY, Date.now().toString(), 'NX', 'EX', SYNC_LOCK_TTL]),
      }
    );

    if (!response.ok) return false;

    const data = await response.json();
    return data.result === 'OK';
  } catch (error) {
    console.warn('[ImageCache] Failed to acquire sync lock:', error);
    return false;
  }
}

export async function releaseSyncLock(): Promise<void> {
  if (!isUpstashConfigured()) return;

  try {
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/del/${SYNC_LOCK_KEY}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );
  } catch (error) {
    console.warn('[ImageCache] Failed to release sync lock:', error);
  }
}

// ============================================
// HELPER: Fetch Image from Zoho
// ============================================

/**
 * Fetch image from Zoho API and return as buffer
 * Uses Zoho Inventory API (images are stored there, not in Books)
 */
export async function fetchImageFromZoho(
  itemId: string,
  accessToken: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    // Use Zoho Inventory API for images
    const ZOHO_INVENTORY_URL = 'https://www.zohoapis.com/inventory/v1';
    const ORGANIZATION_ID = process.env.ZOHO_ORGANIZATION_ID || '748369814';

    const url = `${ZOHO_INVENTORY_URL}/items/${itemId}/image?organization_id=${ORGANIZATION_ID}`;
    console.log(`[ImageCache] Fetching image from: ${url}`);
    console.log(`[ImageCache] Token prefix: ${accessToken?.substring(0, 20)}...`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    console.log(`[ImageCache] Response status: ${response.status}, content-type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[ImageCache] No image found for item ${itemId}`);
        return null;
      }
      const errorText = await response.text();
      console.warn(`[ImageCache] Failed to fetch image for ${itemId}: ${response.status} - ${errorText.substring(0, 200)}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[ImageCache] Successfully fetched image for ${itemId}, size: ${buffer.length} bytes`);
    return { buffer, contentType };
  } catch (error) {
    console.error(`[ImageCache] Error fetching image for ${itemId}:`, error);
    return null;
  }
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  skipped: number;
  duration: number;
  message: string;
}

/**
 * Sync a single product image to Vercel Blob
 */
export async function syncSingleImage(
  itemId: string,
  accessToken: string
): Promise<ImageUploadResult> {
  // Check if already cached
  const existingUrl = await getCachedImageUrl(itemId);
  if (existingUrl) {
    return { success: true, url: existingUrl };
  }

  // Fetch from Zoho
  const imageData = await fetchImageFromZoho(itemId, accessToken);
  if (!imageData) {
    return { success: false, error: 'No image found' };
  }

  // Upload to Blob
  return uploadImageToBlob(itemId, imageData.buffer, imageData.contentType);
}

/**
 * Sync multiple product images in batches
 */
export async function syncImages(
  itemIds: string[],
  accessToken: string,
  options: {
    batchSize?: number;
    delayMs?: number;
    skipExisting?: boolean;
  } = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const { batchSize = 5, delayMs = 500, skipExisting = true } = options;

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  // Check existing cached URLs if skipping
  let itemsToSync = itemIds;
  if (skipExisting) {
    const existingUrls = await getCachedImageUrls(itemIds);
    itemsToSync = itemIds.filter(id => !existingUrls.has(id));
    skipped = itemIds.length - itemsToSync.length;
    console.log(`[ImageCache] Skipping ${skipped} already cached images`);
  }

  // Process in batches
  for (let i = 0; i < itemsToSync.length; i += batchSize) {
    const batch = itemsToSync.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(itemId => syncSingleImage(itemId, accessToken))
    );

    results.forEach((result, index) => {
      if (result.success) {
        synced++;
      } else {
        failed++;
        console.warn(`[ImageCache] Failed to sync ${batch[index]}: ${result.error}`);
      }
    });

    // Update progress
    const progress = Math.round(((i + batch.length) / itemsToSync.length) * 100);
    console.log(`[ImageCache] Progress: ${progress}% (${synced} synced, ${failed} failed)`);

    // Delay between batches to avoid rate limiting
    if (i + batchSize < itemsToSync.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const duration = Date.now() - startTime;

  return {
    success: failed === 0,
    synced,
    failed,
    skipped,
    duration,
    message: `Synced ${synced} images, ${failed} failed, ${skipped} skipped in ${(duration / 1000).toFixed(1)}s`,
  };
}
