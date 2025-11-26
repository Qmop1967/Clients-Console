import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/zoho/client";

// Webhook secret for verification
const WEBHOOK_SECRET = process.env.ZOHO_WEBHOOK_SECRET;

// Verify webhook signature
function verifyWebhook(request: NextRequest): boolean {
  // Implement signature verification based on Zoho's webhook security
  // For now, check a shared secret in headers
  const signature = request.headers.get("x-zoho-webhook-signature");
  return signature === WEBHOOK_SECRET;
}

// Helper to safely revalidate with logging
async function safeRevalidate(tag: string, context?: string) {
  try {
    revalidateTag(tag);
    console.log(`[Webhook] ✅ Revalidated cache: ${tag}${context ? ` (${context})` : ''}`);
  } catch (error) {
    console.error(`[Webhook] ❌ Failed to revalidate tag: ${tag}`, error);
  }
}

// Revalidate all product-related caches
async function revalidateProducts(reason: string) {
  console.log(`[Webhook] 🔄 Revalidating products: ${reason}`);
  await safeRevalidate(CACHE_TAGS.PRODUCTS, reason);
  // Also revalidate the complete products cache
  await safeRevalidate('all-products-complete', reason);
  await safeRevalidate('products-in-stock', reason);
}

export async function POST(request: NextRequest) {
  // Verify webhook authenticity
  if (WEBHOOK_SECRET && !verifyWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { event_type, data } = payload;

    console.log(`[Webhook] Received event: ${event_type}`, data);

    // Handle different event types and revalidate appropriate cache tags
    switch (event_type) {
      // Item/Product events - revalidate all product caches
      case "item.created":
        await revalidateProducts("new product created");
        break;
      case "item.updated":
        await revalidateProducts(`product updated: ${data?.item_id || 'unknown'}`);
        break;
      case "item.deleted":
        await revalidateProducts(`product deleted: ${data?.item_id || 'unknown'}`);
        break;

      // Stock/Inventory change events (critical for accurate display)
      case "inventory.adjusted":
      case "stock.adjusted":
      case "stock_on_hand.updated":
      case "shipmentorder.delivered":
      case "purchaseorder.received":
        await revalidateProducts(`stock changed: ${event_type}`);
        break;

      // Category events
      case "category.created":
      case "category.updated":
      case "category.deleted":
        await safeRevalidate(CACHE_TAGS.CATEGORIES);
        break;

      // Price list events
      case "pricebook.created":
      case "pricebook.updated":
      case "pricebook.deleted":
        await safeRevalidate(CACHE_TAGS.PRICE_LISTS);
        break;

      // Sales order events
      case "salesorder.created":
      case "salesorder.updated":
      case "salesorder.deleted":
        if (data?.customer_id) {
          await safeRevalidate(CACHE_TAGS.ORDERS(data.customer_id));
        }
        break;

      // Invoice events
      case "invoice.created":
      case "invoice.updated":
      case "invoice.deleted":
      case "invoice.paid":
        if (data?.customer_id) {
          await safeRevalidate(CACHE_TAGS.INVOICES(data.customer_id));
        }
        break;

      // Payment events
      case "payment.created":
      case "payment.updated":
      case "payment.deleted":
        if (data?.customer_id) {
          await safeRevalidate(CACHE_TAGS.PAYMENTS(data.customer_id));
          await safeRevalidate(CACHE_TAGS.INVOICES(data.customer_id));
        }
        break;

      // Credit note events
      case "creditnote.created":
      case "creditnote.updated":
      case "creditnote.deleted":
        if (data?.customer_id) {
          await safeRevalidate(CACHE_TAGS.CREDIT_NOTES(data.customer_id));
        }
        break;

      // Customer events
      case "contact.created":
      case "contact.updated":
      case "contact.deleted":
        if (data?.contact_id) {
          await safeRevalidate(CACHE_TAGS.CUSTOMER(data.contact_id));
        }
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event_type}`);
    }

    return NextResponse.json({ success: true, event: event_type });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "zoho-webhook",
    timestamp: new Date().toISOString(),
  });
}
