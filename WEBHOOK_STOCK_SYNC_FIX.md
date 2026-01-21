# Webhook Stock Sync Fix - 2026-01-21

## Problem

Zoho webhooks were not updating stock in real-time. Stock changes would take minutes or hours to appear on the website.

## Root Cause

The webhook handler was using a **fire-and-forget** pattern for stock sync:

1. Webhook received event → extracted item IDs
2. Started stock sync in background (didn't wait)
3. Immediately revalidated cache (BEFORE stock was updated in Redis)
4. If stock sync failed, there was no indication

This meant:
- Cache was revalidated with OLD stock data
- Stock sync failures were silent
- No feedback in webhook response

## Solution

Changed ALL stock-affecting events to use the **wait-and-sync** pattern:

1. Webhook receives event → extracts item IDs
2. **WAITS** for stock sync to complete: `await syncStockForItemsAndWait()`
3. **THEN** revalidates cache (so cache rebuilds with FRESH stock)
4. Returns detailed response with sync status

## Events Fixed

All stock-affecting events now wait for sync:

- ✅ Bills (purchases) - increases stock
- ✅ Purchase Orders - affects committed stock
- ✅ Sales Orders - decreases available stock (committed)
- ✅ Packages/Shipments - releases committed stock
- ✅ Sales Returns - may increase stock when received
- ✅ Sales Return Receive - increases stock
- ✅ Inventory Adjustments - direct stock changes
- ✅ Credit Notes - may increase stock (returned items)
- ✅ Item Updates - may change stock levels
- ✅ Invoices - decreases stock (was already correct)
- ✅ Stock/Inventory events - direct stock changes

## Code Changes

### `/src/app/api/webhooks/zoho/route.ts`

**Before (fire-and-forget):**
```typescript
case "bill":
  await revalidateProducts(`bill received: ${eventType}`);
  // Fire-and-forget - doesn't wait
  syncStockForItems(affectedItemIds, `bill: ${eventType}`);
  break;
```

**After (wait-and-sync):**
```typescript
case "bill": {
  console.log(`[Webhook] 📦 Processing bill: ${eventType}`);

  // CRITICAL: Sync stock FIRST and WAIT for completion
  const billStockResult = await syncStockForItemsAndWait(affectedItemIds, `bill: ${eventType}`);

  // NOW revalidate cache (so it rebuilds with fresh stock)
  await revalidateProducts(`bill received: ${eventType}`);

  // Return detailed response
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
```

### Removed unused function

Removed the fire-and-forget `syncStockForItems()` function to avoid confusion.

## Webhook Response Format

Webhooks now return detailed status:

```json
{
  "success": true,
  "event": "salesorder.created",
  "entity": "salesorder",
  "handled": true,
  "stockSync": {
    "success": true,
    "itemsSynced": 3
  }
}
```

If stock sync fails:
```json
{
  "success": true,
  "event": "salesorder.created",
  "entity": "salesorder",
  "handled": true,
  "stockSync": {
    "success": false,
    "itemsSynced": 0
  }
}
```

## Debugging

Check Vercel logs for webhook execution:

1. Search for `[Webhook] 📦 Processing` to see which events are being handled
2. Search for `[quickSyncStock]` to see stock sync details
3. Look for `✅` (success) or `❌` (error) emojis
4. Check Redis cache status after webhook

### Test Webhook

```bash
# Send test webhook
curl -X POST https://www.tsh.sale/api/webhooks/zoho \
  -H "Content-Type: application/json" \
  -H "x-zoho-webhook-signature: YOUR_SECRET" \
  -d '{"event_type":"salesorder.created","data":{"line_items":[{"item_id":"123"}]}}'

# Check response for stockSync status
# Should see: {"success":true,"stockSync":{"success":true,"itemsSynced":1}}
```

### Check Stock Cache

```bash
# Check cache status
curl "https://www.tsh.sale/api/sync/stock?action=status&secret=tsh-stock-sync-2024"

# Force manual sync if needed
curl "https://www.tsh.sale/api/sync/stock?action=sync&secret=tsh-stock-sync-2024&force=true"
```

## Documentation Updates

Updated `/CLAUDE.md`:
- Added new section: "Webhook Real-Time Stock Sync"
- Added debugging guidance
- Added common issues and solutions
- Added testing instructions
- Updated "Common Mistakes to Avoid" section

## Benefits

1. **Real-time stock updates**: Stock changes appear immediately after webhook
2. **Reliable sync**: Webhook waits for sync to complete before responding
3. **Error visibility**: Webhook response shows if sync failed
4. **Consistent cache**: Cache is revalidated AFTER stock is updated
5. **Better debugging**: Detailed logs with `[quickSyncStock]` prefix

## Testing Checklist

- [ ] Deploy to staging
- [ ] Send test webhook from Zoho (or use curl)
- [ ] Verify webhook response includes `stockSync` status
- [ ] Check Vercel logs for `[quickSyncStock]` entries
- [ ] Verify stock updates appear immediately on website
- [ ] Test with sales order (stock decrease)
- [ ] Test with bill (stock increase)
- [ ] Test with inventory adjustment

## Rollout Plan

1. Deploy to **staging** (preview branch)
2. Test all webhook events
3. Monitor logs for 24 hours
4. Deploy to **production** (main branch) after user approval

## Notes

- This fix ensures webhooks complete stock sync before responding
- May increase webhook response time slightly (1-3 seconds)
- Still much faster than waiting for periodic cron sync
- All stock-affecting events now have consistent behavior
- Removed unused fire-and-forget function to avoid confusion
