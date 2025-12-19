// ============================================
// Mobile Product Detail API
// GET /api/mobile/products/[id]
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuth, mobileSuccess, mobileError } from '@/lib/auth/mobile-middleware';
import { getProductImageUrl } from '@/lib/zoho/products';
import { getUnifiedStock } from '@/lib/zoho/stock-cache';
import { getPriceListWithItems, PRICE_LIST_IDS, PRICE_LIST_INFO, getItemPriceFromList } from '@/lib/zoho/price-lists';
import { zohoFetch, rateLimitedFetch } from '@/lib/zoho/client';
import type { ZohoItem } from '@/types';

interface ZohoBooksSingleItemResponse {
  item: ZohoItem;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return mobileError(
        'INVALID_ID',
        'Product ID is required',
        'معرف المنتج مطلوب',
        400
      );
    }

    // Get base URL for absolute image URLs
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'staging.tsh.sale';
    const baseUrl = `${protocol}://${host}`;

    // Get auth context (optional)
    const auth = await getMobileAuth(request);

    // Determine price list
    let priceListId: string = PRICE_LIST_IDS.CONSUMER;
    let currencyCode = 'IQD';

    if (auth.isAuthenticated && auth.user?.priceListId) {
      priceListId = auth.user.priceListId;
      currencyCode = auth.user.currencyCode || 'IQD';
    }

    const priceListInfo = PRICE_LIST_INFO[priceListId as keyof typeof PRICE_LIST_INFO];

    // Fetch product details from Zoho Books
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoBooksSingleItemResponse>(`/items/${id}`, {
        api: 'books',
      })
    );

    if (!data.item) {
      return mobileError(
        'NOT_FOUND',
        'Product not found',
        'المنتج غير موجود',
        404
      );
    }

    const item = data.item;

    // Get accurate stock from unified stock system
    const stockData = await getUnifiedStock(id);
    const stock = stockData?.stock || 0;

    // Get price from customer's price list (pass [id] as itemIds array for single item)
    const priceList = await getPriceListWithItems(priceListId, [id]);
    const priceData = getItemPriceFromList(id, priceList);
    const price = priceData.rate || null;
    const inPriceList = priceData.inPriceList;

    // Transform for mobile
    const product = {
      id: item.item_id,
      name: item.name,
      sku: item.sku,
      description: item.description || null,
      brand: item.brand || null,
      unit: item.unit || null,
      category_id: item.category_id || null,
      category_name: item.category_name || null,
      // Use absolute URL for mobile images (consistent with products list API)
      image_url: `${baseUrl}/api/zoho/images/${item.item_id}`,
      stock: stock,
      in_stock: stock > 0,
      price: price,
      in_price_list: inPriceList,
      currency: currencyCode,
      price_list: priceListInfo?.name || 'Unknown',
      price_list_ar: priceListInfo?.nameAr || 'غير معروف',
      // Additional detail fields
      tax_name: item.tax_name || null,
      tax_percentage: item.tax_percentage || null,
      is_taxable: item.is_taxable || false,
    };

    return mobileSuccess({ product });

  } catch (error) {
    console.error('[Mobile Product Detail] Error:', error);

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
      'Failed to load product',
      'فشل تحميل المنتج',
      500
    );
  }
}
