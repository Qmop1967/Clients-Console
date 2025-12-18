import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { createSalesOrder, confirmSalesOrder, createInvoiceFromSalesOrder, confirmInvoice } from '@/lib/zoho/orders';
import { z } from 'zod';

// Validation schema for checkout request
const checkoutSchema = z.object({
  items: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().positive(),
    rate: z.number().positive(),
    name: z.string(),
    sku: z.string(),
  })),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();

    if (!session?.user?.zohoContactId) {
      return NextResponse.json(
        { error: 'Authentication required. Please login to place an order.' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { items, notes } = validation.data;

    // Check if there are items to order
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items in cart' },
        { status: 400 }
      );
    }

    // Generate reference number (e.g., WEB-20241128-123456)
    const timestamp = new Date();
    const referenceNumber = `WEB-${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}-${String(timestamp.getTime()).slice(-6)}`;

    // Prepare line items for Zoho
    const lineItems = items.map(item => ({
      item_id: item.item_id,
      quantity: item.quantity,
      rate: item.rate,
    }));

    // Create order notes with item details
    const orderNotes = [
      notes || '',
      '',
      'Order placed via TSH Web Portal',
      `Items: ${items.map(i => `${i.name} (${i.sku}) x${i.quantity}`).join(', ')}`,
    ].filter(Boolean).join('\n');

    console.log(`[Checkout] Creating order for customer ${session.user.zohoContactId}`);
    console.log(`[Checkout] Reference: ${referenceNumber}`);
    console.log(`[Checkout] Items: ${JSON.stringify(lineItems)}`);

    // Step 1: Create the sales order in Zoho Inventory
    const result = await createSalesOrder({
      customer_id: session.user.zohoContactId,
      line_items: lineItems,
      notes: orderNotes,
      reference_number: referenceNumber,
    });

    if (!result.success || !result.order) {
      console.error('[Checkout] Failed to create order:', result.error);
      return NextResponse.json(
        {
          error: result.error || 'Failed to create order. Please try again or contact support.',
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    const order = result.order;
    console.log(`[Checkout] Order created successfully: ${order.salesorder_number}`);

    // Step 2: Confirm the sales order
    const confirmed = await confirmSalesOrder(order.salesorder_id);
    if (!confirmed) {
      console.warn(`[Checkout] Failed to confirm order ${order.salesorder_number}, continuing anyway`);
    } else {
      console.log(`[Checkout] Order ${order.salesorder_number} confirmed`);
    }

    // Step 3: Create invoice from the sales order
    const invoice = await createInvoiceFromSalesOrder(order.salesorder_id);
    let invoiceNumber = null;
    let invoiceId = null;

    if (invoice) {
      invoiceNumber = invoice.invoice_number;
      invoiceId = invoice.invoice_id;
      console.log(`[Checkout] Invoice ${invoiceNumber} created for order ${order.salesorder_number}`);

      // Step 4: Confirm the invoice (mark as sent)
      const invoiceConfirmed = await confirmInvoice(invoice.invoice_id);
      if (!invoiceConfirmed) {
        console.warn(`[Checkout] Failed to confirm invoice ${invoiceNumber}, continuing anyway`);
      } else {
        console.log(`[Checkout] Invoice ${invoiceNumber} confirmed (sent)`);
      }
    } else {
      console.warn(`[Checkout] Failed to create invoice for order ${order.salesorder_number}`);
    }

    return NextResponse.json({
      success: true,
      order: {
        salesorder_id: order.salesorder_id,
        salesorder_number: order.salesorder_number,
        reference_number: order.reference_number,
        total: order.total,
        status: confirmed ? 'confirmed' : order.status,
        date: order.date,
      },
      invoice: invoice ? {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
      } : null,
    });

  } catch (error) {
    console.error('[Checkout] Error:', error);

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return NextResponse.json(
        { error: 'Server is busy. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process your order. Please try again.' },
      { status: 500 }
    );
  }
}
