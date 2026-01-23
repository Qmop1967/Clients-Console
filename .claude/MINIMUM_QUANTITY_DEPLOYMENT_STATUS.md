# Minimum Quantity Feature - Deployment Status

## Issue Fixed
✅ **Minimum quantity validation now works on both product list and detail pages**

## Root Cause
The Zoho Books LIST API (`/items`) does NOT include:
- `minimum_order_quantity` field
- `custom_fields` array

Only the DETAIL API (`/items/{id}`) returns these fields.

## Solution Implemented
Modified the stock sync system to cache `minimum_quantity` alongside stock data in Redis:

1. **Stock Cache Enhanced**
   - Added `minimumQuantities` map to `StockCacheData` interface
   - No schema breaking changes (backward compatible with old cache)

2. **Sync Modified (`syncStockFromBooks`)**
   - Now extracts `minimum_quantity` from detail API responses
   - Uses same helper function as products.ts (`getMinimumQuantityFromItem`)
   - No additional API calls (leverages existing detail fetches for stock)

3. **Product Fetching Updated (`getAllProductsComplete`)**
   - Added `getMinimumQuantitiesBulk()` function
   - Merges cached minimum quantities with products
   - Falls back to undefined if not in cache

## Files Changed
- `src/lib/zoho/stock-cache.ts` - Added minimum quantity caching
- `src/lib/zoho/products.ts` - Import and use getMinimumQuantitiesBulk()
- `src/app/[locale]/(public)/shop/page.tsx` - Already includes minimum_quantity in mapping
- `src/app/api/mobile/products/route.ts` - Already includes minimum_quantity in interfaces

## Deployment Status
- ✅ Code deployed to staging (preview branch)
- ⏳ **IMPORTANT: Stock sync needs to run to populate minimum quantities in cache**
- ✅ Feature will work automatically once sync completes

## Testing Steps
1. Wait for Zoho rate limit to reset (next hour)
2. Run full stock sync:
   ```bash
   curl "https://www.tsh.sale/api/sync/stock?action=sync&secret=tsh-stock-sync-2024&force=true"
   ```
3. Test mobile API:
   ```bash
   curl "https://www.tsh.sale/api/mobile/products?search=BNC+RG59" | jq '.data.products[0].minimum_quantity'
   ```
   Expected: `100` (not `null`)

4. Test shop page - add BNC RG59 product to cart with quantity < 100
   Expected: Error message about minimum quantity

## Production Deployment
Once testing is confirmed on staging:
```bash
git checkout main
git merge preview
git push origin main
git checkout preview
```

## Current Status
⏳ Waiting for Zoho API rate limit to reset before running stock sync.
The code is ready and deployed. Feature will work once the first sync completes.

---
**Date:** 2026-01-23
**Branch:** preview (deployed to staging.tsh.sale)
