import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, getAccessToken } from "@/lib/zoho/client";
import {
  syncSingleImage,
  hasImageChangedMultiSignal,
  getStoredImageDocId,
  deleteImageFromBlob,
  clearImageCache
} from "@/lib/blob/image-cache";
import { quickSyncStock } from "@/lib/zoho/stock-cache";

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
  // Package/Shipment events
  'package', 'packages', 'shipment', 'shipments',
  // Sales Return events (CRITICAL for stock)
  'salesreturn', 'sales_return', 'salesreturns',
  'salesreturnreceive', 'returnreceipt', 'return_receipt',
  // Inventory Adjustment events (CRITICAL for stock)
  'inventoryadjustment', 'inventory_adjustment', 'stockadjustment',
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
    // Package/Shipment mappings
    'packages': 'package',
    'shipment': 'package',
    'shipments': 'package',
    // Sales Return mappings (CRITICAL for stock)
    'salesreturn': 'salesreturn',
    'salesreturns': 'salesreturn',
    // Sales Return Receive mappings (CRITICAL for stock)
    'salesreturnreceive': 'salesreturnreceive',
    'returnreceipt': 'salesreturnreceive',
    // Inventory Adjustment mappings (CRITICAL for stock)
    'inventoryadjustment': 'inventoryadjustment',
    'stockadjustment': 'inventoryadjustment',
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

// Revalidate all product-related caches (both data and ISR page cache)
async function revalidateProducts(reason: string) {
  console.log(`[Webhook] 🔄 Revalidating products: ${reason}`);

  // Revalidate data cache (unstable_cache)
  await safeRevalidate(CACHE_TAGS.PRODUCTS, reason);
  await safeRevalidate('all-products-complete', reason);
  await safeRevalidate('all-products-complete-books', reason);
  await safeRevalidate('products-in-stock', reason);

  // CRITICAL: Also revalidate ISR page cache for shop pages
  // This ensures stock changes are reflected immediately on rendered pages
  // Note: "page" type revalidates the specific page and all dynamic children
  try {
    revalidatePath("/[locale]/(public)/shop", "page");
    revalidatePath("/en/shop", "page");
    revalidatePath("/ar/shop", "page");
    console.log(`[Webhook] ✅ Revalidated ISR shop pages (${reason})`);
  } catch (error) {
    console.error(`[Webhook] ❌ Failed to revalidate ISR pages:`, error);
  }
}

// Extract item IDs from webhook data (line_items, items array, or single item)
function extractItemIds(data: Record<string, unknown>): string[] {
  const itemIds: string[] = [];

  // Single item
  if (data.item_id && typeof data.item_id === 'string') {
    itemIds.push(data.item_id);
  }

  // Line items array (bills, sales orders, invoices, etc.)
  if (Array.isArray(data.line_items)) {
    for (const item of data.line_items) {
      if (item && typeof item === 'object' && 'item_id' in item && typeof item.item_id === 'string') {
        itemIds.push(item.item_id);
      }
    }
  }

  // Items array (some webhook formats)
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item && typeof item === 'object' && 'item_id' in item && typeof item.item_id === 'string') {
        itemIds.push(item.item_id);
      }
    }
  }

  return [...new Set(itemIds)]; // Remove duplicates
}

// Sync stock for affected items AND WAIT for completion
// Use this when you need cache revalidation AFTER stock sync
async function syncStockForItemsAndWait(itemIds: string[], reason: string): Promise<boolean> {
  if (itemIds.length === 0) return true;

  console.log(`[Webhook] 📦 Syncing stock for ${itemIds.length} items (awaited): ${reason}`);

  try {
    const result = await quickSyncStock(itemIds);

    if (result.success) {
      console.log(`[Webhook] ✅ Stock synced for ${result.itemsUpdated} items`);
      return true;
    } else {
      console.error(`[Webhook] ⚠️ Stock sync partial failure: ${result.itemsUpdated}/${itemIds.length} updated`);
      if (result.errors.length > 0) {
        console.error(`[Webhook] ❌ Errors: ${result.errors.join(', ')}`);
      }
      // Return true if at least some items were updated
      return result.itemsUpdated > 0;
    }
  } catch (error) {
    console.error(`[Webhook] ❌ Stock sync failed:`, error);
    return false;
  }
}

// Result type for invoice line items fetch
interface InvoiceLineItemsResult {
  success: boolean;
  itemIds: string[];
  notFound?: boolean;  // true if invoice doesn't exist (404)
  error?: string;
}

// Fetch invoice line items from Zoho Books API
// Zoho webhooks don't include line_items, so we need to fetch the full invoice
// Returns result object instead of throwing - handles 404 gracefully
async function fetchInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItemsResult> {
  const token = await getAccessToken();
  const orgId = process.env.ZOHO_ORGANIZATION_ID || '748369814';

  console.log(`[Webhook] 📋 Fetching invoice ${invoiceId} from Zoho Books API...`);

  const response = await fetch(
    `https://www.zohoapis.com/books/v3/invoices/${invoiceId}?organization_id=${orgId}`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');

    // Handle 404 "Resource does not exist" gracefully
    // This happens when invoice was deleted or doesn't exist
    if (response.status === 404) {
      console.log(`[Webhook] ℹ️ Invoice ${invoiceId} not found (404) - likely deleted`);
      return { success: true, itemIds: [], notFound: true };
    }

    const errorMsg = `Zoho API returned ${response.status}: ${errorText}`;
    console.error(`[Webhook] ❌ Failed to fetch invoice ${invoiceId}: ${errorMsg}`);
    return { success: false, itemIds: [], error: errorMsg };
  }

  const data = await response.json();
  const lineItems = data.invoice?.line_items || [];

  if (lineItems.length === 0) {
    console.log(`[Webhook] ℹ️ Invoice ${invoiceId} has no line_items`);
    return { success: true, itemIds: [] };
  }

  const itemIds = lineItems
    .filter((item: { item_id?: string }) => item.item_id)
    .map((item: { item_id: string }) => item.item_id);

  console.log(`[Webhook] ✅ Fetched ${itemIds.length} items from invoice ${invoiceId}: [${itemIds.join(', ')}]`);
  return { success: true, itemIds };
}

// Fetch item image info from Zoho API when webhook doesn't include it
// Returns { hasImage, imageDocId } or null on error
async function fetchItemImageInfo(itemId: string): Promise<{
  hasImage: boolean;
  imageDocId: string | null;
  imageName: string | null;
} | null> {
  try {
    const token = await getAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID || '748369814';

    console.log(`[Webhook] 📋 Fetching item ${itemId} image info from Zoho...`);

    // Use Books API to get item details (includes image_document_id)
    const response = await fetch(
      `https://www.zohoapis.com/books/v3/items/${itemId}?organization_id=${orgId}`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[Webhook] ❌ Failed to fetch item ${itemId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const item = data.item;

    if (!item) {
      console.error(`[Webhook] ❌ No item data in response for ${itemId}`);
      return null;
    }

    const hasImage = !!(item.image_document_id || item.image_name);

    console.log(`[Webhook] ✅ Item ${itemId} image info: hasImage=${hasImage}, docId=${item.image_document_id || 'none'}`);

    return {
      hasImage,
      imageDocId: item.image_document_id || null,
      imageName: item.image_name || null,
    };
  } catch (error) {
    console.error(`[Webhook] ❌ Error fetching item image info:`, error);
    return null;
  }
}

// Delete product image from Vercel Blob and clear Redis cache
async function deleteProductImage(itemId: string, reason: string): Promise<boolean> {
  try {
    console.log(`[Webhook] 🗑️ Deleting image for ${itemId}: ${reason}`);

    // Delete from Vercel Blob
    const deleteResult = await deleteImageFromBlob(itemId);
    if (!deleteResult) {
      console.log(`[Webhook] ⚠️ No Blob image found to delete for ${itemId}`);
    }

    // Clear Redis cache
    await clearImageCache(itemId);

    console.log(`[Webhook] ✅ Image deleted for ${itemId}`);
    return true;
  } catch (error) {
    console.error(`[Webhook] ❌ Failed to delete image for ${itemId}:`, error);
    return false;
  }
}

// Sync product image to Vercel Blob with multi-signal change detection
// Uses both imageDocId AND imageName to detect changes more reliably
// Set forceSync=true to always re-sync regardless of change detection (for item.updated events)
async function syncProductImage(
  itemId: string,
  reason: string,
  options: {
    imageDocId?: string | null;
    imageName?: string | null;
    forceSync?: boolean;  // Skip change detection entirely
  } = {}
) {
  const { imageDocId, imageName, forceSync = false } = options;

  try {
    console.log(`[Webhook] 🖼️ Checking image for ${itemId}: ${reason} (forceSync=${forceSync})`);

    // If not forcing, use multi-signal change detection
    if (!forceSync && (imageDocId || imageName)) {
      const { changed, reason: changeReason } = await hasImageChangedMultiSignal(itemId, imageDocId, imageName);
      if (!changed) {
        console.log(`[Webhook] ⏭️ Image unchanged for ${itemId} (${changeReason})`);
        return;
      }
      console.log(`[Webhook] 🔄 Image change detected for ${itemId}: ${changeReason}`);
    }

    const token = await getAccessToken();

    // Determine if we should force (forceSync or change detected)
    const shouldForce = forceSync || !!(imageDocId || imageName);

    const result = await syncSingleImage(itemId, token, {
      force: shouldForce,
      imageDocId: imageDocId || undefined,
      imageName: imageName || undefined,
    });

    if (result.success) {
      if (result.unchanged) {
        console.log(`[Webhook] ⏭️ Image unchanged for ${itemId} (cached)`);
      } else {
        console.log(`[Webhook] ✅ Image synced for ${itemId}: ${result.url}`);
      }
    } else {
      console.log(`[Webhook] ⚠️ Image sync failed for ${itemId}: ${result.error}`);
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

    // Log concisely - avoid printing full dataKeys array (can be 100+ items)
    const hasLineItems = 'line_items' in data;
    const lineItemCount = hasLineItems && Array.isArray(data.line_items) ? data.line_items.length : 0;
    console.log(`[Webhook] ${eventType} | items: ${lineItemCount} | keys: ${Object.keys(data).length}`);

    // Extract item IDs from webhook data for stock sync
    const affectedItemIds = extractItemIds(data);

    // Handle based on entity type for better coverage
    switch (entityType) {
      // ============================================
      // PURCHASE/STOCK EVENTS - Affect inventory
      // ============================================
      case "bill": {
        // Purchase bills receive inventory - MUST sync stock FIRST, then revalidate
        console.log(`[Webhook] 📦 Processing bill: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT for completion
        const billStockResult = await syncStockForItemsAndWait(affectedItemIds, `bill: ${eventType}`);

        // NOW revalidate cache (so it rebuilds with fresh stock)
        await revalidateProducts(`bill received: ${eventType}`);

        // Check if line items have item IDs to sync images (only if not already cached)
        if (Array.isArray(data.line_items)) {
          for (const item of data.line_items as Array<{ item_id?: string }>) {
            if (item.item_id) {
              syncProductImage(item.item_id, "bill line item", {}).catch(() => {});
            }
          }
        }

        // Return detailed response for bill events
        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: billStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      case "purchaseorder": {
        // Purchase orders may affect committed stock
        console.log(`[Webhook] 📦 Processing purchase order: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const poStockResult = await syncStockForItemsAndWait(affectedItemIds, `purchase order: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`purchase order: ${eventType}`);

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: poStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      case "vendorpayment":
      case "expense":
        // These don't affect product stock, just log
        console.log(`[Webhook] Vendor/expense event: ${eventType} - no action needed`);
        break;

      // ============================================
      // ITEM/PRODUCT EVENTS
      // ============================================
      case "item": {
        console.log(`[Webhook] 📦 Processing item: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const itemStockResult = await syncStockForItemsAndWait(affectedItemIds, `item: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`item ${eventType}`);

        // Handle image sync with deletion detection
        const itemId = (data.item_id as string) || (data.id as string);
        if (itemId) {
          // Get image info from webhook payload
          let imageDocId = data.image_document_id as string | null | undefined;
          let imageName = data.image_name as string | null | undefined;

          // If webhook doesn't include image info, fetch from Zoho API
          if (imageDocId === undefined && imageName === undefined) {
            console.log(`[Webhook] 🔍 Webhook missing image info for ${itemId}, fetching from API...`);
            const itemInfo = await fetchItemImageInfo(itemId);
            if (itemInfo) {
              imageDocId = itemInfo.imageDocId;
              imageName = itemInfo.imageName;
            }
          }

          // Detect image deletion: we had a cached image but Zoho no longer has one
          if (!imageDocId && !imageName) {
            const storedDocId = await getStoredImageDocId(itemId);
            if (storedDocId) {
              console.log(`[Webhook] 🗑️ Image deleted in Zoho for ${itemId} (had docId: ${storedDocId})`);
              // Image was deleted - clear Blob and Redis
              await deleteProductImage(itemId, "image deleted in Zoho");
            } else {
              console.log(`[Webhook] ℹ️ No image for ${itemId} (and no cached image)`);
            }
          } else if (imageDocId || imageName) {
            // Image exists - sync with FORCE to ensure replaced images are updated
            // forceSync=true bypasses change detection which may fail if Zoho reuses docId
            syncProductImage(itemId, eventType, {
              imageDocId,
              imageName,
              forceSync: true,  // CRITICAL: Always re-sync on item.updated to catch replaced images
            }).catch(() => {});
          }
        }

        // Return detailed response for item events
        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: itemStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      // ============================================
      // STOCK/INVENTORY CHANGE EVENTS
      // ============================================
      case "inventory":
      case "stock":
      case "shipmentorder": {
        console.log(`[Webhook] 📦 Processing stock change: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const stockChangeResult = await syncStockForItemsAndWait(affectedItemIds, `stock: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`stock changed: ${eventType}`);

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: stockChangeResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      // ============================================
      // PACKAGE/SHIPMENT EVENTS
      // ============================================
      case "package": {
        // Packages affect order fulfillment and may release committed stock
        console.log(`[Webhook] 📦 Processing package: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const pkgStockResult = await syncStockForItemsAndWait(affectedItemIds, `package: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`package shipped: ${eventType}`);

        const pkgCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (pkgCustomerId) {
          await safeRevalidate(CACHE_TAGS.ORDERS(pkgCustomerId), eventType);
        }

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: pkgStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      // ============================================
      // SALES RETURN EVENTS (CRITICAL for stock)
      // ============================================
      case "salesreturn": {
        // Sales returns affect stock (items potentially coming back)
        console.log(`[Webhook] 📦 Processing sales return: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const srStockResult = await syncStockForItemsAndWait(affectedItemIds, `sales return: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`sales return: ${eventType}`);

        const srCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (srCustomerId) {
          await safeRevalidate(CACHE_TAGS.ORDERS(srCustomerId), eventType);
        }

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: srStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      // ============================================
      // SALES RETURN RECEIVE EVENTS (CRITICAL for stock)
      // ============================================
      case "salesreturnreceive": {
        // When return is physically received, stock increases
        console.log(`[Webhook] 📦 Processing sales return receive: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const srrStockResult = await syncStockForItemsAndWait(affectedItemIds, `sales return received: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`sales return received: ${eventType}`);

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: srrStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      // ============================================
      // INVENTORY ADJUSTMENT EVENTS (CRITICAL for stock)
      // ============================================
      case "inventoryadjustment": {
        // Direct stock adjustments (damage, theft, count corrections)
        console.log(`[Webhook] 📦 Processing inventory adjustment: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const iaStockResult = await syncStockForItemsAndWait(affectedItemIds, `inventory adjustment: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`inventory adjusted: ${eventType}`);

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: iaStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

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
      case "salesorder": {
        // Sales orders affect both stock (committed) and customer orders
        console.log(`[Webhook] 📦 Processing sales order: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const soStockResult = await syncStockForItemsAndWait(affectedItemIds, `sales order: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`sales order: ${eventType}`);

        const soCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (soCustomerId) {
          await safeRevalidate(CACHE_TAGS.ORDERS(soCustomerId), eventType);
        }

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: soStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

      // ============================================
      // INVOICE EVENTS
      // ============================================
      case "invoice": {
        // Track success for response
        let stockSyncSuccess = false;
        let stockSyncError: string | null = null;
        let itemsSynced = 0;
        let invoiceNotFound = false;

        // Zoho webhooks don't include line_items, so we need to fetch them from API
        const invoiceId = (data.invoice_id as string) || (data.id as string);
        if (invoiceId) {
          console.log(`[Webhook] 🧾 Processing invoice ${invoiceId}`);

          // Fetch line items from Zoho API - handles 404 gracefully
          const fetchResult = await fetchInvoiceLineItems(invoiceId);

          if (fetchResult.notFound) {
            // Invoice was deleted - this is expected, not an error
            stockSyncSuccess = true;
            invoiceNotFound = true;
            console.log(`[Webhook] ℹ️ Invoice ${invoiceId} was deleted - skipping stock sync`);
          } else if (!fetchResult.success) {
            // Actual API error (not 404)
            stockSyncError = fetchResult.error || 'Unknown error';
            console.error(`[Webhook] ❌ Invoice ${invoiceId} fetch failed: ${stockSyncError}`);
          } else if (fetchResult.itemIds.length > 0) {
            // IMPORTANT: Sync stock FIRST and WAIT for completion
            // Then revalidate cache so it rebuilds with fresh stock data
            const syncResult = await syncStockForItemsAndWait(fetchResult.itemIds, `invoice: ${eventType}`);
            stockSyncSuccess = syncResult;
            itemsSynced = fetchResult.itemIds.length;
            if (!syncResult) {
              stockSyncError = 'Stock sync returned false';
              console.error(`[Webhook] ❌ Stock sync FAILED for invoice ${invoiceId}`);
            }
          } else {
            // No line items is not an error, but note it
            stockSyncSuccess = true;
            console.log(`[Webhook] ℹ️ Invoice ${invoiceId} has no inventory items to sync`);
          }
        } else {
          stockSyncError = 'Invoice webhook missing invoice_id';
          console.error(`[Webhook] ❌ ${stockSyncError}`);
        }

        // NOW revalidate products cache (AFTER stock sync completed or failed)
        await revalidateProducts(`invoice: ${eventType}`);

        // Also revalidate customer invoices list
        const invCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (invCustomerId) {
          await safeRevalidate(CACHE_TAGS.INVOICES(invCustomerId), eventType);
        }

        // Return detailed response for invoice events
        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          invoiceId,
          invoiceNotFound,
          stockSync: {
            success: stockSyncSuccess,
            itemsSynced,
            error: stockSyncError,
          },
          message: invoiceNotFound
            ? 'Invoice not found (deleted)'
            : stockSyncSuccess
              ? `Stock synced for ${itemsSynced} items`
              : `Stock sync failed: ${stockSyncError}`,
        });
      }

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
      // Credit notes with returned items affect stock levels
      // ============================================
      case "creditnote": {
        // Credit notes may include returned items that increase stock
        console.log(`[Webhook] 📦 Processing credit note: ${eventType}`);

        // CRITICAL: Sync stock FIRST and WAIT
        const cnStockResult = await syncStockForItemsAndWait(affectedItemIds, `credit note: ${eventType}`);

        // NOW revalidate cache
        await revalidateProducts(`credit note: ${eventType}`);

        // Also revalidate customer credit notes list
        const cnCustomerId = (data.customer_id as string) || (data.contact_id as string);
        if (cnCustomerId) {
          await safeRevalidate(CACHE_TAGS.CREDIT_NOTES(cnCustomerId), eventType);
        }

        return NextResponse.json({
          success: true,
          event: eventType,
          entity: entityType,
          handled: true,
          stockSync: {
            success: cnStockResult,
            itemsSynced: affectedItemIds.length,
          },
        });
      }

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
