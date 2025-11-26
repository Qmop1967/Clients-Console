// ============================================
// Zoho API Client - Server Only
// ============================================

import { unstable_cache } from 'next/cache';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';
const ZOHO_BOOKS_URL = 'https://www.zohoapis.com/books/v3';
const ZOHO_INVENTORY_URL = 'https://www.zohoapis.com/inventory/v1';

// Token storage (in production, use Vercel KV or Redis)
let cachedToken: { access_token: string; expires_at: number } | null = null;

export async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  // Refresh the token
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    console.error('Token refresh failed:', await response.text());
    throw new Error('Failed to refresh Zoho access token');
  }

  const data = await response.json();

  // Cache the token (expires in 1 hour, we refresh 5 min early)
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  };

  return cachedToken.access_token;
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

// Rate limiting helper
let requestCount = 0;
let resetTime = Date.now() + 60000;

export async function rateLimitedFetch<T>(
  fetchFn: () => Promise<T>
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
  return fetchFn();
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
