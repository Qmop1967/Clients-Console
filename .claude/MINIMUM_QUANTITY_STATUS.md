# Minimum Quantity Feature - Implementation Status

## Current Status: PARTIALLY IMPLEMENTED ⚠️

The minimum quantity validation feature has been implemented in the codebase, but the custom field data is not being fetched from Zoho Books API.

---

## What's Been Implemented ✅

### 1. **Type Definitions** (Complete)
- Added `custom_fields` and `minimum_quantity` to ZohoItem interface
- Added `minimum_quantity` to CartItem interface
- Created MinimumQuantityError interface for validation responses

### 2. **Data Extraction Logic** (Complete)
- Created `getMinimumQuantityFromItem()` helper function in products.ts:118
- Checks for API field name: `cf_minimum_quantity_limitation`
- Also falls back to label: "Minimum Quantity Limitation"
- Properly handles string/number conversion and validation

### 3. **Cart Validation** (Complete)
- Updated cart provider with validation logic
- `validateMinimumQuantity()` checks total quantity (cart + new)
- `addItem()` returns MinimumQuantityError for failed validation

### 4. **UI Components** (Complete)
- Product detail page shows minimum quantity badge and error alerts
- Product card shows native browser alert on validation failure
- Translations added for English and Arabic

### 5. **Product Detail Page Integration** (Complete)
- Added minimum_quantity to FetchResult type (line 56)
- Pass minimum_quantity from Zoho product to component (line 110)

---

## The Problem ❌

**Zoho Books API is not returning custom_fields in the response.**

### Evidence:
1. Product data fetching works correctly (getProduct function)
2. Custom field extraction logic is correct (checks for cf_minimum_quantity_limitation)
3. Data is passed through properly (page → component)
4. UI components are ready to display the badge
5. **BUT**: Zoho API response doesn't include custom_fields array

### Testing on: BNC RG59 Standard Connector (item ID: 2646610000006437073)
- Zoho shows custom field set: "Minimum Quantity Limitation" = 100
- API field name: `cf_minimum_quantity_limitation`
- Console UI confirms value is set to 100
- **BUT**: Product page doesn't show minimum quantity badge

---

## Investigation Needed 🔍

### Possible Causes:

1. **Zoho Books API doesn't include custom fields by default**
   - May need to add query parameter like `include=custom_fields`
   - May need to use different API endpoint
   - Check Zoho Books API documentation

2. **Organization settings**
   - Custom fields might be disabled at org level
   - Permissions might not allow API access to custom fields

3. **API version issue**
   - Older API version might not support custom fields
   - Check if we're using the latest Zoho Books API version

---

## Files to Check

### 1. Zoho API Client (`src/lib/zoho/client.ts`)
Check if we need to add parameters to API requests:
```typescript
// May need something like:
zohoFetch('/items/123', {
  api: 'books',
  params: {
    include: 'custom_fields'  // ← Need to verify
  }
})
```

### 2. Zoho Books API Documentation
- Search for "custom fields" in Zoho Books API docs
- Check Items API endpoint documentation
- Look for required parameters or headers

---

## Quick Test

To verify if custom fields are being returned, deploy and test this endpoint:
```
GET https://staging.tsh.sale/api/debug/item/2646610000006437073
```

The response should show:
```json
{
  "success": true,
  "hasCustomFields": true,
  "customFields": [
    {
      "customfield_id": "cf_minimum_quantity_limitation",
      "label": "Minimum Quantity Limitation",
      "value": 100
    }
  ]
}
```

If `hasCustomFields: false`, then Zoho API is not returning the data.

---

## Next Steps

1. **Check Zoho Books API documentation** for custom fields
2. **Add required parameters** to API calls if needed
3. **Test with debug endpoint** to verify data is being returned
4. **Update MINIMUM_QUANTITY_FEATURE.md** once working

---

## Code Locations

| Component | File | Status |
|-----------|------|--------|
| Type definitions | `src/types/index.ts` | ✅ Complete |
| Data fetching | `src/lib/zoho/products.ts:118` | ✅ Logic ready, but data not returned from API |
| Cart validation | `src/components/providers/cart-provider.tsx` | ✅ Complete |
| Product detail | `src/app/[locale]/(public)/shop/[id]/page.tsx:110` | ✅ Complete |
| Product component | `src/components/products/product-detail-content.tsx` | ✅ Complete |
| Product card | `src/components/products/product-card.tsx` | ✅ Complete |
| Translations | `src/messages/en.json`, `ar.json` | ✅ Complete |

---

**Last Updated:** 2026-01-23
**Status:** Awaiting Zoho API investigation
