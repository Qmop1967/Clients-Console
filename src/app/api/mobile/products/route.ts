// ============================================
// Mobile Products API
// GET /api/mobile/products
// ============================================
// Returns products with pricing based on auth status:
// - Public: Consumer prices (IQD)
// - Authenticated: Customer's assigned price list
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuth, mobileSuccess, mobileError } from '@/lib/auth/mobile-middleware';
import { getProductsWithPrices, getProductImageUrl } from '@/lib/zoho/products';
import { PRICE_LIST_IDS, PRICE_LIST_INFO } from '@/lib/zoho/price-lists';
import type { ZohoItem } from '@/types';

// Product with price type from getProductsWithPrices
interface ProductWithPrice {
  item_id: string;
  name: string;
  sku: string;
  description?: string;
  brand?: string;
  category_id?: string;
  category_name?: string;
  unit?: string;
  available_stock?: number;
  display_price: number;
  price_currency: string;
  in_price_list: boolean;
}

// Transform product for mobile response (smaller payload)
function transformProductForMobile(item: ProductWithPrice) {
  return {
    id: item.item_id,
    name: item.name,
    sku: item.sku,
    description: item.description || null,
    brand: item.brand || null,
    category_id: item.category_id || null,
    category_name: item.category_name || null,
    unit: item.unit || null,
    image_url: `/api/zoho/images/${item.item_id}`,
    stock: item.available_stock || 0,
    in_stock: (item.available_stock || 0) > 0,
    price: item.display_price || null,
    in_price_list: item.in_price_list,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get auth context (optional for products)
    const auth = await getMobileAuth(request);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim() || '';
    const categoryId = searchParams.get('category_id') || '';
    const inStockOnly = searchParams.get('in_stock') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '50', 10), 100);

    // Determine which price list to use
    let priceListId: string = PRICE_LIST_IDS.CONSUMER;
    let currencyCode = 'IQD';

    if (auth.isAuthenticated && auth.user?.priceListId) {
      priceListId = auth.user.priceListId;
      currencyCode = auth.user.currencyCode || 'IQD';
    }

    // Get price list metadata
    const priceListInfo = PRICE_LIST_INFO[priceListId as keyof typeof PRICE_LIST_INFO];

    console.log(`[Mobile Products] Fetching with priceListId: ${priceListId}, auth: ${auth.isAuthenticated}`);

    // Fetch products with prices
    const result = await getProductsWithPrices(priceListId);

    if (!result.products || result.products.length === 0) {
      return mobileSuccess({
        products: [],
        currency: currencyCode,
        price_list: priceListInfo?.name || 'Unknown',
      }, {
        page: 1,
        per_page: perPage,
        total_items: 0,
        total_pages: 0,
        has_more: false,
      });
    }

    // Transform and filter products
    let products = result.products.map(p =>
      transformProductForMobile(p as unknown as ProductWithPrice)
    );

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower)) ||
        (p.brand && p.brand.toLowerCase().includes(searchLower))
      );
    }

    // Apply category filter
    if (categoryId) {
      products = products.filter(p => p.category_id === categoryId);
    }

    // Apply in-stock filter
    if (inStockOnly) {
      products = products.filter(p => p.in_stock);
    }

    // Calculate pagination
    const totalItems = products.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;

    // Slice for current page
    const paginatedProducts = products.slice(startIndex, endIndex);

    return mobileSuccess({
      products: paginatedProducts,
      currency: currencyCode,
      price_list: priceListInfo?.name || 'Unknown',
      price_list_ar: priceListInfo?.nameAr || 'غير معروف',
    }, {
      page,
      per_page: perPage,
      total_items: totalItems,
      total_pages: totalPages,
      has_more: page < totalPages,
    });

  } catch (error) {
    console.error('[Mobile Products] Error:', error);

    // Check for rate limit error
    if (error instanceof Error && error.message.includes('rate')) {
      return mobileError(
        'RATE_LIMITED',
        'Server is busy. Please try again in a moment.',
        'الخادم مشغول. يرجى المحاولة بعد قليل.',
        429
      );
    }

    return mobileError(
      'SERVER_ERROR',
      'Failed to load products',
      'فشل تحميل المنتجات',
      500
    );
  }
}
