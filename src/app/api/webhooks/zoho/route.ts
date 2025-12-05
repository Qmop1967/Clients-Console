import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, getAccessToken } from "@/lib/zoho/client";
import { syncSingleImage } from "@/lib/blob/image-cache";

// Webhook secret for verification
const WEBHOOK_SECRET = process.env.ZOHO_WEBHOOK_SECRET;

// Known Zoho entity types that can be sent as raw objects
const ZOHO_ENTITY_TYPES = [
  'bill', 'bills',
  'purchaseorder', 'purchase_order',
  'salesorder', 'sales_order',
  'invoice', 'invoices',
  'payment', 'customerpayment', 'customer_payment',
  'creditnote', 'credit_note',
  'item', 'items',
  'contact', 'contacts',
  'category', 'categories',
  'pricebook', 'price_book',
  'vendorpayment', 'vendor_payment',
  'expense', 'expenses',
] as const;

// Normalize entity type to standard format
function normalizeEntityType(key: string): string {
  const normalized = key.toLowerCase().replace(/_/g, '');
  // Map plural to singular and normalize names
  const mapping: Record<string, string> = {
    'bills': 'bill',
    'purchaseorder': 'bill', // Purchase orders affect stock like bills
    'purchaseorders': 'bill',
    'salesorder': 'salesorder',
    'salesorders': 'salesorder',
    'invoices': 'invoice',
    'payments': 'payment',
    'customerpayment': 'payment',
    'customerpayments': 'payment',
    'creditnote': 'creditnote',
    'creditnotes': 'creditnote',
    'items': 'item',
    'contacts': 'contact',
    'categories': 'category',
    'pricebook': 'pricebook',
    'pricebooks': 'pricebook',
    'vendorpayment': 'vendorpayment',
    'vendorpayments': 'vendorpayment',
    'expenses': 'expense',
  };
  return mapping[normalized] || normalized;
}

// Detect and parse Zoho webhook payload (handles both formats)
interface ParsedWebhook {
  eventType: string;
  entityType: string;
  data: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
}

function parseZohoWebhook(payload: Record<string, unknown>): ParsedWebhook {
  // Format 1: Standard event format { event_type, data }
  if (payload.event_type && typeof payload.event_type === 'string') {
    return {
      eventType: payload.event_type,
      entityType: payload.event_type.split('.')[0],
      data: (payload.data as Record<string, unknown>) || {},
      rawPayload: payload,
    };
  }

  // Format 2: Raw entity format { bill: {...} } or { salesorder: {...} }
  for (const key of Object.keys(payload)) {
    const normalizedKey = key.toLowerCase();
    if (ZOHO_ENTITY_TYPES.some(t => normalizedKey === t || normalizedKey === t.replace(/_/g, ''))) {
      const entityData = payload[key] as Record<string, unknown>;
      const entityType = normalizeEntityType(key);

      // Infer event type - we'll treat it as "updated" since we don't know
      // (Zoho workflow webhooks typically fire on create/update)
      return {
        eventType: `${entityType}.updated`,
        entityType: entityType,
        data: entityData,
        rawPayload: payload,
      };
    }
  }

  // Format 3: Unknown format - return as-is with unknown type
  return {
    eventType: 'unknown',
    entityType: 'unknown',
    data: payload,
    rawPayload: payload,
  };
}

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

    // Parse the webhook payload (handles both standard and raw entity formats)
    const parsed = parseZohoWebhook(payload);
    const { eventType, entityType, data } = parsed;

    console.log(`[Webhook] Received: ${eventType} (entity: ${entityType})`, {
      dataKeys: Object.keys(data),
      hasLineItems: 'line_items' in data,
    });

    // Handle based on entity type for better coverage
    switch (entityType) {
      // ============================================
      // PURCHASE/STOCK EVENTS - Affect inventory
      // ============================================
      case "bill":
        // Purchase bills receive inventory - MUST revalidate stock
        await revalidateProducts(`bill received: ${eventType}`);
        // Check if line items have item IDs to sync images
        if (Array.isArray(data.line_items)) {
          for (const item of data.line_items as Array<{ item_id?: string }>) {
            if (item.item_id) {
              syncProductImage(item.item_id, "bill line item").catch(() => {});
            }
          }
        }
        break;

      case "purchaseorder":
        // Purchase orders may affect committed stock
        await revalidateProducts(`purchase order: ${eventType}`);
        break;

      case "vendorpayment":
      case "expense":
        // These don't affect product stock, just log
        console.log(`[Webhook] Vendor/expense event: ${eventType} - no action needed`);
        break;

      // ============================================
      // ITEM/PRODUCT EVENTS
      // ============================================
      case "item":
        await revalidateProducts(`item ${eventType}`);
        // Sync image for item events
        const itemId = (data.item_id as string) || (data.id as string);
        if (itemId) {
          syncProductImage(itemId, eventType).catch(() => {});
        }
        break;

      // ============================================
      // STOCK/INVENTORY CHANGE EVENTS
      // ============================================
      case "inventory":
      case "stock":
      case "shipmentorder":
        await revalidateProducts(`stock changed: ${eventType}`);
        break;

      // ============================================
      // CATEGORY EVENTS
      // ============================================
      case "category":
        await safeRevalidate(CACHE_TAGS.CATEGORIES, eventType);
        break;

      // ============================================
      // PRICE LIST EVENTS
      // ============================================
      case "pricebook":
        await safeRevalidate(CACHE_TAGS.PRICE_LISTS, eventType);
        break;

      // ============================================
      // SALES ORDER EVENTS
      // ============================================
      case "salesorder":
        // Sales orders affect both stock (committed) and customer orders
        await revalidateProducts(`sales order: ${eventType}`);
        const soCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (soCustomerId) {
          await safeRevalidate(CACHE_TAGS.ORDERS(soCustomerId), eventType);
        }
        break;

      // ============================================
      // INVOICE EVENTS
      // ============================================
      case "invoice":
        const invCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (invCustomerId) {
          await safeRevalidate(CACHE_TAGS.INVOICES(invCustomerId), eventType);
        }
        break;

      // ============================================
      // PAYMENT EVENTS
      // ============================================
      case "payment":
        const payCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (payCustomerId) {
          await safeRevalidate(CACHE_TAGS.PAYMENTS(payCustomerId), eventType);
          await safeRevalidate(CACHE_TAGS.INVOICES(payCustomerId), eventType);
        }
        break;

      // ============================================
      // CREDIT NOTE EVENTS
      // ============================================
      case "creditnote":
        const cnCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (cnCustomerId) {
          await safeRevalidate(CACHE_TAGS.CREDIT_NOTES(cnCustomerId), eventType);
        }
        break;

      // ============================================
      // CONTACT/CUSTOMER EVENTS
      // ============================================
      case "contact":
        const contactId = (data.contact_id as string) || (data.id as string);
        if (contactId) {
          await safeRevalidate(CACHE_TAGS.CUSTOMER(contactId), eventType);
        }
        break;

      // ============================================
      // UNKNOWN EVENTS
      // ============================================
      default:
        console.log(`[Webhook] Unhandled entity type: ${entityType} (event: ${eventType})`);
        // For unknown events that might affect products, revalidate to be safe
        if (payload.line_items || payload.item_id || payload.items) {
          console.log(`[Webhook] Unknown event has item data - revalidating products`);
          await revalidateProducts(`unknown event with items: ${eventType}`);
        }
    }

    return NextResponse.json({
      success: true,
      event: eventType,
      entity: entityType,
      handled: entityType !== 'unknown',
    });
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
