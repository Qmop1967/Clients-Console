import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, getAccessToken } from "@/lib/zoho/client";
import { syncSingleImage } from "@/lib/blob/image-cache";

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

// Sync product image to Vercel Blob (fire-and-forget)
async function syncProductImage(itemId: string, reason: string) {
  try {
    console.log(`[Webhook] 🖼️ Syncing image for ${itemId}: ${reason}`);
    const token = await getAccessToken();
    const result = await syncSingleImage(itemId, token);
    if (result.success) {
      console.log(`[Webhook] ✅ Image synced for ${itemId}: ${result.url}`);
    } else {
      console.log(`[Webhook] ⚠️ Image sync skipped for ${itemId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[Webhook] ❌ Failed to sync image for ${itemId}:`, error);
  }
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
      // Item/Product events - revalidate caches and sync images
      case "item.created":
        await revalidateProducts("new product created");
        // Sync image to Blob CDN (fire-and-forget, don't block response)
        if (data?.item_id) {
          syncProductImage(data.item_id, "new product").catch(() => {});
        }
        break;
      case "item.updated":
        await revalidateProducts(`product updated: ${data?.item_id || 'unknown'}`);
        // Re-sync image in case it changed
        if (data?.item_id) {
          syncProductImage(data.item_id, "product updated").catch(() => {});
        }
        break;
      case "item.deleted":
        await revalidateProducts(`product deleted: ${data?.item_id || 'unknown'}`);
        // Note: We don't delete from Blob to avoid orphaned images
        // Blob cleanup can be done periodically if needed
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
