/**
 * Mobile Products API - GET /api/mobile/products
 *
 * Returns products with pricing based on auth status:
 * - Public: Consumer prices (IQD)
 * - Authenticated: Customer's assigned price list
 */

import { NextRequest } from 'next/server';
import { getMobileAuth, mobileSuccess, mobileError } from '@/lib/auth/mobile-middleware';
import { getProductsWithPrices } from '@/lib/zoho/products';
import { PRICE_LIST_IDS, PRICE_LIST_INFO } from '@/lib/zoho/price-lists';

// Allow 60 seconds for product fetching with prices
export const maxDuration = 60;

// Product type from getProductsWithPrices result
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

interface MobileProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  category_name: string | null;
  unit: string | null;
  image_url: string;
  stock: number;
  in_stock: boolean;
  price: number | null;
  in_price_list: boolean;
}

function transformProductForMobile(item: ProductWithPrice, baseUrl: string): MobileProduct {
  const stock = item.available_stock ?? 0;
  return {
    id: item.item_id,
    name: item.name,
    sku: item.sku,
    description: item.description ?? null,
    brand: item.brand ?? null,
    category_id: item.category_id ?? null,
    category_name: item.category_name ?? null,
    unit: item.unit ?? null,
    image_url: `${baseUrl}/api/zoho/images/${item.item_id}`,
    stock,
    in_stock: stock > 0,
    price: item.display_price ?? null,
    in_price_list: item.in_price_list,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await getMobileAuth(request);

    // Build base URL for absolute image URLs (required for iOS AsyncImage)
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'staging.tsh.sale';
    const baseUrl = `${protocol}://${host}`;

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search')?.trim() || '';
    const categoryId = searchParams.get('category_id') || '';
    const inStockOnly = searchParams.get('in_stock') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '50', 10), 100);

    // Determine price list based on auth status
    const priceListId = auth.isAuthenticated && auth.user?.priceListId
      ? auth.user.priceListId
      : PRICE_LIST_IDS.CONSUMER;
    const currencyCode = auth.isAuthenticated && auth.user?.currencyCode
      ? auth.user.currencyCode
      : 'IQD';
    const priceListInfo = PRICE_LIST_INFO[priceListId as keyof typeof PRICE_LIST_INFO];

    console.log(`[Mobile Products] priceListId: ${priceListId}, auth: ${auth.isAuthenticated}`);

    // Fetch products with prices
    const result = await getProductsWithPrices(priceListId);

    // Transform products to mobile format
    let products = (result.products ?? []).map(p =>
      transformProductForMobile(p as unknown as ProductWithPrice, baseUrl)
    );

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.brand?.toLowerCase().includes(searchLower)
      );
    }

    if (categoryId) {
      products = products.filter(p => p.category_id === categoryId);
    }

    if (inStockOnly) {
      products = products.filter(p => p.in_stock);
    }

    // Paginate
    const totalItems = products.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const paginatedProducts = products.slice((page - 1) * perPage, page * perPage);

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
