// ============================================
// Mobile Order Detail API
// GET /api/mobile/orders/[id]
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getOrderWithDetails } from '@/lib/zoho/orders';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const authResult = await requireMobileAuth(request);
    if (isAuthError(authResult)) {
      return authResult;
    }

    const auth = authResult;
    const user = auth.user!;

    if (!id) {
      return mobileError(
        'INVALID_ID',
        'Order ID is required',
        'معرف الطلب مطلوب',
        400
      );
    }

    // Fetch order detail (getOrderWithDetails returns {order, packages, shipments})
    const { order, packages, shipments } = await getOrderWithDetails(id, user.zohoContactId);

    if (!order) {
      return mobileError(
        'NOT_FOUND',
        'Order not found',
        'الطلب غير موجود',
        404
      );
    }

    // Transform line items (use name || item_name for API compatibility)
    const lineItems = (order.line_items || []).map((item) => ({
      id: item.line_item_id,
      item_id: item.item_id,
      name: item.name || item.item_name || '',
      sku: item.sku || null,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.item_total || (item.quantity * item.rate),
      unit: item.unit || null,
    }));

    // Transform packages (from getOrderWithDetails response)
    const transformedPackages = packages.map((pkg: { package_id: string; package_number: string; date: string; status: string; tracking_number?: string; delivery_method?: string }) => ({
      id: pkg.package_id,
      number: pkg.package_number,
      date: pkg.date,
      status: pkg.status,
      tracking_number: pkg.tracking_number || null,
      carrier: pkg.delivery_method || null,
    }));

    // Transform shipments (from getOrderWithDetails response)
    const transformedShipments = shipments.map((ship: { shipment_id: string; shipment_number: string; date: string; status: string; tracking_number?: string; delivery_method?: string }) => ({
      id: ship.shipment_id,
      number: ship.shipment_number,
      date: ship.date,
      status: ship.status,
      tracking_number: ship.tracking_number || null,
      carrier: ship.delivery_method || null,
    }));

    return mobileSuccess({
      order: {
        id: order.salesorder_id,
        number: order.salesorder_number,
        reference: order.reference_number || null,
        date: order.date,
        status: order.status,
        subtotal: order.sub_total,
        tax: order.tax_total || 0,
        discount: order.discount || 0,
        total: order.total,
        currency: order.currency_code || user.currencyCode,
        notes: order.notes || null,
        created_time: order.created_time,
        line_items: lineItems,
        packages: transformedPackages,
        shipments: transformedShipments,
      },
    });

  } catch (error) {
    console.error('[Mobile Order Detail] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load order details',
      'فشل تحميل تفاصيل الطلب',
      500
    );
  }
}
