// ============================================
// Zoho API Client - Server Only
// ============================================
// Token caching strategy (in order of preference):
// 1. Upstash Redis REST API (if UPSTASH_REDIS_REST_URL configured)
// 2. Vercel KV (if KV_REST_API_URL configured)
// 3. In-memory cache (fallback, per-invocation only)
// ============================================

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';
const ZOHO_BOOKS_URL = 'https://www.zohoapis.com/books/v3';
const ZOHO_INVENTORY_URL = 'https://www.zohoapis.com/inventory/v1';

// Key for storing the Zoho token
const ZOHO_TOKEN_KEY = 'zoho:access_token';

// Token type
interface CachedToken {
  access_token: string;
  expires_at: number;
}

// In-memory fallback (for local dev or when external cache fails)
let memoryCache: CachedToken | null = null;

// Track last refresh attempt to prevent spam
let lastRefreshAttempt = 0;
const MIN_REFRESH_INTERVAL = 10000; // 10 seconds minimum between refresh attempts

// ============================================
// CACHE STRATEGY 1: Upstash Redis REST API
// ============================================
// Simple REST API, no SDK needed, works in serverless
// Get a free account at https://upstash.com
// ============================================

function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function getTokenFromUpstash(): Promise<CachedToken | null> {
  if (!isUpstashConfigured()) return null;

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${ZOHO_TOKEN_KEY}`,
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
      const token = JSON.parse(data.result) as CachedToken;
      if (process.env.NODE_ENV === 'development') console.log('[Zoho] Token from Upstash Redis');
      return token;
    }
    return null;
  } catch (error) {
    console.warn('[Zoho] Failed to get token from Upstash:', error);
    return null;
  }
}

async function saveTokenToUpstash(token: CachedToken): Promise<void> {
  if (!isUpstashConfigured()) return;

  try {
    // Store with TTL of 50 minutes (3000 seconds)
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/setex/${ZOHO_TOKEN_KEY}/3000/${encodeURIComponent(JSON.stringify(token))}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    if (response.ok) {
      if (process.env.NODE_ENV === 'development') console.log('[Zoho] Token saved to Upstash');
    }
  } catch (error) {
    console.warn('[Zoho] Failed to save token to Upstash:', error);
  }
}

// ============================================
// CACHE STRATEGY 2: Vercel KV
// ============================================
// Requires KV setup in Vercel dashboard
// ============================================

function isVercelKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getTokenFromVercelKv(): Promise<CachedToken | null> {
  if (!isVercelKvConfigured()) return null;

  try {
    // Use REST API directly instead of SDK to avoid import issues
    const response = await fetch(
      `${process.env.KV_REST_API_URL}/get/${ZOHO_TOKEN_KEY}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.result) {
      const token = typeof data.result === 'string'
        ? JSON.parse(data.result)
        : data.result;
      if (process.env.NODE_ENV === 'development') console.log('[Zoho] Token from Vercel KV');
      return token as CachedToken;
    }
    return null;
  } catch (error) {
    console.warn('[Zoho] Failed to get token from Vercel KV:', error);
    return null;
  }
}

async function saveTokenToVercelKv(token: CachedToken): Promise<void> {
  if (!isVercelKvConfigured()) return;

  try {
    // Store with TTL of 50 minutes (3000 seconds)
    const response = await fetch(
      `${process.env.KV_REST_API_URL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SETEX', ZOHO_TOKEN_KEY, 3000, JSON.stringify(token)]),
      }
    );

    if (response.ok) {
      if (process.env.NODE_ENV === 'development') console.log('[Zoho] Token saved to Vercel KV');
    }
  } catch (error) {
    console.warn('[Zoho] Failed to save token to Vercel KV:', error);
  }
}

// ============================================
// UNIFIED CACHE OPERATIONS
// ============================================

async function getTokenFromCache(): Promise<CachedToken | null> {
  // Try Upstash first (preferred)
  const upstashToken = await getTokenFromUpstash();
  if (upstashToken) return upstashToken;

  // Try Vercel KV
  const kvToken = await getTokenFromVercelKv();
  if (kvToken) return kvToken;

  return null;
}

async function saveTokenToCache(token: CachedToken): Promise<void> {
  // Save to all configured caches in parallel
  await Promise.all([
    saveTokenToUpstash(token),
    saveTokenToVercelKv(token),
  ]);
}

export async function getAccessToken(): Promise<string> {
  // Step 1: Check in-memory cache first (fastest)
  if (memoryCache && memoryCache.expires_at > Date.now()) {
    return memoryCache.access_token;
  }

  // Step 2: Check external cache (Upstash or Vercel KV)
  const cachedToken = await getTokenFromCache();
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    memoryCache = cachedToken; // Cache in memory for this invocation
    return cachedToken.access_token;
  }

  // Step 3: Rate limit guard - prevent token refresh spam
  const now = Date.now();
  if (now - lastRefreshAttempt < MIN_REFRESH_INTERVAL) {
    const waitTime = MIN_REFRESH_INTERVAL - (now - lastRefreshAttempt);
    if (process.env.NODE_ENV === 'development') console.log(`[Zoho] Rate limit guard: waiting ${waitTime}ms...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRefreshAttempt = Date.now();

  // Step 4: Refresh the token from Zoho
  if (process.env.NODE_ENV === 'development') console.log('[Zoho] Refreshing access token...');

  // Log cache status for debugging
  const cacheStatus = {
    upstash: isUpstashConfigured(),
    vercelKv: isVercelKvConfigured(),
    memoryCache: !!memoryCache,
  };
  console.log('📊 Cache status:', cacheStatus);

  // Check if environment variables are set
  if (!process.env.ZOHO_REFRESH_TOKEN) {
    throw new Error('ZOHO_REFRESH_TOKEN environment variable is missing');
  }
  if (!process.env.ZOHO_CLIENT_ID) {
    throw new Error('ZOHO_CLIENT_ID environment variable is missing');
  }
  if (!process.env.ZOHO_CLIENT_SECRET) {
    throw new Error('ZOHO_CLIENT_SECRET environment variable is missing');
  }

  // Refresh the token
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error('[Zoho] Token refresh failed:', response.status, responseText);

    // If rate limited, wait longer and retry once
    if (response.status === 400 && responseText.includes('too many requests')) {
      console.log('[Zoho] Rate limited, waiting 10 seconds before retry...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const retryResponse = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!retryResponse.ok) {
        const retryText = await retryResponse.text();
        throw new Error(`Token refresh failed after retry: ${retryResponse.status} - ${retryText}`);
      }

      const retryData = await retryResponse.json();
      if (retryData.access_token) {
        const token: CachedToken = {
          access_token: retryData.access_token,
          expires_at: Date.now() + (retryData.expires_in - 300) * 1000,
        };
        memoryCache = token;
        await saveTokenToCache(token);
        if (process.env.NODE_ENV === 'development') console.log('[Zoho] Token refreshed after retry');
        return token.access_token;
      }
    }

    throw new Error(`Failed to refresh Zoho access token: ${response.status} - ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('Invalid token response from Zoho');
  }

  if (!data.access_token) {
    throw new Error('No access_token in Zoho response');
  }

  // Cache the token (expires in 1 hour, we refresh 5 min early)
  const token: CachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  };

  // Save to memory and external caches
  memoryCache = token;
  await saveTokenToCache(token);

  if (process.env.NODE_ENV === 'development') console.log('[Zoho] Access token refreshed and cached');
  return token.access_token;
}

// Generic fetch wrapper for Zoho API calls
export async function zohoFetch<T>(
  endpoint: string,
  options: {
    api?: 'books' | 'inventory';
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    params?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  const { api = 'books', method = 'GET', body, params } = options;
  const baseUrl = api === 'books' ? ZOHO_BOOKS_URL : ZOHO_INVENTORY_URL;
  const organizationId = process.env.ZOHO_ORGANIZATION_ID;

  const token = await getAccessToken();

  // Build URL with query params
  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set('organization_id', organizationId!);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  const headers: HeadersInit = {
    Authorization: `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Zoho API error (${endpoint}):`, errorText);
    throw new Error(`Zoho API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Rate limiting helper with retry logic
let requestCount = 0;
let resetTime = Date.now() + 60000;

export async function rateLimitedFetch<T>(
  fetchFn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  // Reset counter every minute
  if (Date.now() > resetTime) {
    requestCount = 0;
    resetTime = Date.now() + 60000;
  }

  // Zoho limit is ~100 requests per minute
  if (requestCount >= 90) {
    const waitTime = resetTime - Date.now();
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    requestCount = 0;
    resetTime = Date.now() + 60000;
  }

  requestCount++;

  // Try with exponential backoff on rate limit errors
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error as Error;

      // Get error message - handle both Error objects and strings
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if it's a rate limit error (429 or Zoho code 43)
      const isRateLimit = errorMsg.includes('429') ||
                          errorMsg.includes('code":43') ||
                          errorMsg.includes('blocked') ||
                          errorMsg.includes('exceeded the maximum');

      if (isRateLimit) {
        // Exponential backoff: 2s, 4s, 8s
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        console.log(`[Zoho] Rate limited, retrying in ${waitTime/1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue; // Try again
      } else {
        // Not a rate limit error, don't retry
        throw error;
      }
    }
  }

  // All retries exhausted
  console.error(`[Zoho] Rate limit retries exhausted after ${maxRetries} attempts`);
  throw lastError;
}

// Cache tags for revalidation
export const CACHE_TAGS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  PRICE_LISTS: 'price-lists',
  CUSTOMER: (id: string) => `customer:${id}`,
  ORDERS: (customerId: string) => `orders:${customerId}`,
  INVOICES: (customerId: string) => `invoices:${customerId}`,
  PAYMENTS: (customerId: string) => `payments:${customerId}`,
  CREDIT_NOTES: (customerId: string) => `credit-notes:${customerId}`,
} as const;
