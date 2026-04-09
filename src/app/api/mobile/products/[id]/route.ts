// ============================================
// Mobile Product Detail API
// GET /api/mobile/products/[id]
// ============================================

import { NextRequest } from 'next/server';
import { getMobileAuth, mobileSuccess, mobileError } from '@/lib/auth/mobile-middleware';
import { getProductById, getProductImageUrl } from '@/lib/odoo/products';
import { getUnifiedStock } from '@/lib/odoo/stock';
import { getCustomerPriceList, getItemPriceFromList, PRICE_LIST_IDS } from '@/lib/odoo/pricelists';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return mobileError('INVALID_ID', 'Product ID is required', 'معرف المنتج مطلوب', 400);
    }

    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'www.tsh.sale';
    const baseUrl = `${protocol}://${host}`;

    const auth = await getMobileAuth(request);

    // Fetch product
    const product = await getProductById(id);
    if (!product) {
      return mobileError('NOT_FOUND', 'Product not found', 'المنتج غير موجود', 404);
    }

    // Get stock
    const stockResult = await getUnifiedStock(id);
    const stock = stockResult.stock;

    // Get price from pricelist
    const priceListId = auth.isAuthenticated && auth.user?.priceListId
      ? auth.user.priceListId
      : PRICE_LIST_IDS.CONSUMER;

    const priceList = await getCustomerPriceList(priceListId, [id]);
    const priceInfo = getItemPriceFromList(id, priceList);

    return mobileSuccess({
      product: {
        id: product.item_id,
        name: product.name,
        sku: product.sku,
        description: product.description || null,
        brand: product.brand || null,
        category_id: product.category_id || null,
        category_name: product.category_name || null,
        unit: product.unit || null,
        image_url: product.image_url || `${baseUrl}/api/images/${product.item_id}`,
        stock,
        in_stock: stock > 0,
        price: priceInfo.rate,
        currency: priceInfo.currency,
        in_price_list: priceInfo.inPriceList,
        minimum_quantity: product.minimum_quantity || null,
      },
    });
  } catch (error) {
    console.error('[Mobile Product Detail] Error:', error);
    return mobileError('SERVER_ERROR', 'Failed to load product', 'فشل تحميل المنتج', 500);
  }
}
