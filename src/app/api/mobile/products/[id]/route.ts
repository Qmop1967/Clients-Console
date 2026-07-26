// ============================================
// Mobile Product Detail API
// GET /api/mobile/products/[id]
// ============================================

import { NextRequest } from 'next/server';
import { getMobileAuth, mobileSuccess, mobileError } from '@/lib/auth/mobile-middleware';
import { getPublicProductByIdStrict } from '@/lib/odoo/products';
import { getUnifiedStock } from '@/lib/odoo/stock';
import { getCustomerPriceList, getItemPriceFromList, getConsumerPricelistId, isValidPublicPrice } from '@/lib/odoo/pricelists';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return mobileError('INVALID_ID', 'Product ID is required', 'معرف المنتج مطلوب', 400);
    }

    const baseUrl = 'https://tsh.sale';

    const auth = await getMobileAuth(request);

    // Fetch product
    const product = await getPublicProductByIdStrict(id);
    if (!product) {
      return mobileError('NOT_FOUND', 'Product not found', 'المنتج غير موجود', 404);
    }

    // Get stock
    const stockResult = await getUnifiedStock(id);
    const exactStock = stockResult.stock;
    const stock = auth.isAuthenticated ? exactStock : (exactStock > 0 ? 1 : 0);

    // Get price from pricelist
    const consumerPricelistId = await getConsumerPricelistId();
    const priceListId = auth.isAuthenticated && auth.user?.priceListId
      ? auth.user.priceListId
      : consumerPricelistId;

    const priceList = await getCustomerPriceList(priceListId, [id]);
    const priceInfo = getItemPriceFromList(id, priceList);
    const canDisplayPrice = priceInfo.inPriceList && (
      auth.isAuthenticated || isValidPublicPrice(priceInfo.rate, priceInfo.currency)
    );

    // no-store: product metadata carries image_version; must always be fresh so
    // set-main/unset-main reflect on normal reload/navigation. Image BINARIES are
    // cached aggressively via the versioned /api/images URL (immutable), not here.
    const _res = mobileSuccess({
      product: {
        id: product.item_id,
        name: product.name,
        sku: product.sku,
        description: product.description || null,
        brand: product.brand || null,
        category_id: product.category_id || null,
        category_name: product.category_name || null,
        unit: product.unit || null,
        image_url: product.image_url
          ? product.image_url.startsWith('https://') ? product.image_url : `${baseUrl}${product.image_url}`
          : null,
        image_version: null,
        stock,
        in_stock: stock > 0,
        price: canDisplayPrice ? priceInfo.rate : 0,
        currency: priceInfo.currency,
        in_price_list: canDisplayPrice,
        minimum_quantity: product.minimum_quantity || null,
      },
    });
    _res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return _res;
  } catch (error) {
    console.error('[Mobile Product Detail] Error:', error);
    return mobileError('SERVER_ERROR', 'Failed to load product', 'فشل تحميل المنتج', 500);
  }
}
