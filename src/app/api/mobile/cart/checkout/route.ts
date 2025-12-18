// ============================================
// Mobile Checkout API
// POST /api/mobile/cart/checkout
// ============================================
// Creates a sales order in Zoho Inventory
// Requires authentication
// ============================================

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import {
  createSalesOrder,
  confirmSalesOrder,
  createInvoiceFromSalesOrder,
  confirmInvoice,
} from '@/lib/zoho/orders';

// Validation schema
const checkoutSchema = z.object({
  items: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().positive(),
    rate: z.number().positive(),
    name: z.string(),
    sku: z.string(),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireMobileAuth(request);
    if (isAuthError(authResult)) {
      return authResult;
    }

    const auth = authResult;
    const user = auth.user!;

    if (!user.zohoContactId) {
      return mobileError(
        'NO_CUSTOMER',
        'Your account is not linked to a customer record. Please contact support.',
        'حسابك غير مرتبط بسجل عميل. يرجى التواصل مع الدعم.',
        400
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten();
      return mobileError(
        'INVALID_REQUEST',
        errors.formErrors[0] || 'Invalid order data',
        'بيانات الطلب غير صالحة',
        400
      );
    }

    const { items, notes } = validation.data;

    // Generate reference number
    const timestamp = new Date();
    const referenceNumber = `APP-${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}-${String(timestamp.getTime()).slice(-6)}`;

    // Prepare line items
    const lineItems = items.map(item => ({
      item_id: item.item_id,
      quantity: item.quantity,
      rate: item.rate,
    }));

    // Create order notes
    const orderNotes = [
      notes || '',
      '',
      'Order placed via TSH Mobile App',
      `Items: ${items.map(i => `${i.name} (${i.sku}) x${i.quantity}`).join(', ')}`,
    ].filter(Boolean).join('\n');

    console.log(`[Mobile Checkout] Creating order for customer ${user.zohoContactId}`);
    console.log(`[Mobile Checkout] Reference: ${referenceNumber}`);

    // Step 1: Create the sales order
    const result = await createSalesOrder({
      customer_id: user.zohoContactId,
      line_items: lineItems,
      notes: orderNotes,
      reference_number: referenceNumber,
    });

    if (!result.success || !result.order) {
      console.error('[Mobile Checkout] Failed to create order:', result.error);
      return mobileError(
        'ORDER_FAILED',
        result.error || 'Failed to create order. Please try again.',
        'فشل إنشاء الطلب. يرجى المحاولة مرة أخرى.',
        500
      );
    }

    const order = result.order;
    console.log(`[Mobile Checkout] Order created: ${order.salesorder_number}`);

    // Step 2: Confirm the order
    const confirmed = await confirmSalesOrder(order.salesorder_id);
    if (!confirmed) {
      console.warn(`[Mobile Checkout] Failed to confirm order ${order.salesorder_number}`);
    } else {
      console.log(`[Mobile Checkout] Order confirmed: ${order.salesorder_number}`);
    }

    // Step 3: Create invoice
    let invoiceNumber = null;
    let invoiceId = null;

    const invoice = await createInvoiceFromSalesOrder(order.salesorder_id);
    if (invoice) {
      invoiceNumber = invoice.invoice_number;
      invoiceId = invoice.invoice_id;
      console.log(`[Mobile Checkout] Invoice created: ${invoiceNumber}`);

      // Step 4: Confirm invoice
      const invoiceConfirmed = await confirmInvoice(invoice.invoice_id);
      if (!invoiceConfirmed) {
        console.warn(`[Mobile Checkout] Failed to confirm invoice ${invoiceNumber}`);
      }
    }

    return mobileSuccess({
      order: {
        id: order.salesorder_id,
        number: order.salesorder_number,
        reference: order.reference_number,
        total: order.total,
        status: confirmed ? 'confirmed' : order.status,
        date: order.date,
      },
      invoice: invoice ? {
        id: invoiceId,
        number: invoiceNumber,
      } : null,
      message: 'Order placed successfully',
      message_ar: 'تم تقديم الطلب بنجاح',
    });

  } catch (error) {
    console.error('[Mobile Checkout] Error:', error);

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
      'Failed to process your order. Please try again.',
      'فشل معالجة طلبك. يرجى المحاولة مرة أخرى.',
      500
    );
  }
}
