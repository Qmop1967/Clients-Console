# Minimum Quantity Restriction Feature

## Overview

This feature enforces minimum order quantities for products that have the "Minimum Quantity Limitation" custom field set in Zoho Books. When customers try to add items to their cart with quantities below the minimum, they will see a clear error message in both English and Arabic.

---

## Implementation Summary

### 1. **Type Definitions** (`src/types/index.ts`)

Added support for custom fields and minimum quantity:

```typescript
export interface ZohoItem {
  // ... existing fields ...
  custom_fields?: Array<{
    customfield_id: string;
    label: string;
    value: string | number;
  }>;
  minimum_quantity?: number;
}

export interface CartItem {
  // ... existing fields ...
  minimum_quantity?: number;
}

export interface MinimumQuantityError {
  hasError: boolean;
  message?: string;
  minimumQuantity?: number;
  attemptedQuantity?: number;
}
```

---

### 2. **Product Fetching** (`src/lib/zoho/products.ts`)

#### Helper Function
```typescript
function getMinimumQuantityFromItem(item: ZohoBooksItem): number | undefined {
  // Extracts "Minimum Quantity Limitation" from custom_fields
  // Returns undefined if not set or invalid
}
```

#### Integration
- Custom fields are now fetched from Zoho Books API
- `minimum_quantity` is automatically extracted and added to all products
- The field name in Zoho must be exactly: **"Minimum Quantity Limitation"** (case-insensitive)

---

### 3. **Cart Provider** (`src/components/providers/cart-provider.tsx`)

#### Validation Function
```typescript
validateMinimumQuantity(item, quantity): MinimumQuantityError
```

Checks if the total quantity (cart + new quantity) meets the minimum requirement.

#### Updated `addItem` Function
- Now returns `MinimumQuantityError` instead of `void`
- Validates minimum quantity before adding to cart
- Returns error details if validation fails

#### Success Response
```typescript
{ hasError: false }
```

#### Error Response
```typescript
{
  hasError: true,
  minimumQuantity: 100,
  attemptedQuantity: 50,
  message: "Minimum order quantity for this item is 100 pcs"
}
```

---

### 4. **Translations**

Added to both `en.json` and `ar.json`:

| Key | English | Arabic |
|-----|---------|--------|
| `minimumQuantity` | Minimum Quantity | الحد الأدنى للكمية |
| `minimumQuantityRequired` | Minimum order quantity: {quantity} {unit} | الحد الأدنى للطلب: {quantity} {unit} |
| `minimumQuantityError` | This item has a minimum order quantity of {quantity} {unit}. Please add at least {quantity} {unit} to your cart. | هذا المنتج له حد أدنى للطلب هو {quantity} {unit}. يرجى إضافة {quantity} {unit} على الأقل إلى سلتك. |
| `minimumQuantityNotMet` | Minimum quantity not met | لم يتم تحقيق الحد الأدنى للكمية |
| `minimumQuantityWarning` | You are trying to add {attempted} {unit}, but the minimum order quantity is {minimum} {unit}. | أنت تحاول إضافة {attempted} {unit}، ولكن الحد الأدنى للطلب هو {minimum} {unit}. |

---

### 5. **Product Detail Page** (`src/components/products/product-detail-content.tsx`)

#### Features
1. **Minimum Quantity Badge**: Shows "Minimum order quantity: 100 pcs" above quantity input
2. **Error Alert**: Displays prominent red alert when validation fails
3. **Auto-dismiss**: Error automatically hides after 5 seconds

#### UI Flow
```
User selects quantity → Clicks "Add to Cart"
↓
Cart validates minimum quantity
↓
If validation fails:
  → Show alert: "Minimum quantity not met"
  → Display error message
  → Item NOT added to cart
↓
If validation passes:
  → Add item to cart
  → Show success message
```

---

### 6. **Product Card** (`src/components/products/product-card.tsx`)

#### Quick Add Validation
- When user clicks "Add to Cart" on product card (shop listing)
- If minimum quantity > 1, shows native browser alert:
  ```
  "This item has a minimum order quantity of 100 pcs.
   Please add at least 100 pcs to your cart."
  ```
- Item is NOT added to cart if validation fails

---

## How It Works

### In Zoho Books

1. Go to **Items** module
2. Edit an item
3. Find custom field: **"Minimum Quantity Limitation"**
4. Set the value (e.g., `100`)
5. Save the item

### In TSH Clients Console

1. **Product fetched from Zoho**
   - API includes `custom_fields` array
   - `getMinimumQuantityFromItem()` extracts the value

2. **User tries to add to cart**
   - Cart provider checks: `currentQty + newQty >= minimum_quantity`
   - If fails: Returns error with details
   - If passes: Adds item to cart

3. **UI shows appropriate feedback**
   - Product detail: Alert component (dismissible)
   - Product card: Browser alert (blocking)

---

## Validation Logic

```typescript
// Example: Item has minimum_quantity = 100

// Scenario 1: First time adding
currentQty = 0
attemptedQty = 50
total = 50
✗ FAIL: 50 < 100

// Scenario 2: Adding to existing cart
currentQty = 60
attemptedQty = 50
total = 110
✓ PASS: 110 >= 100

// Scenario 3: Exact minimum
currentQty = 0
attemptedQty = 100
total = 100
✓ PASS: 100 >= 100
```

---

## Testing

### Test Cases

1. **Item without minimum quantity**
   - Should add to cart normally with any quantity

2. **Item with minimum quantity = 100**
   - Try adding 50 → Should show error
   - Try adding 100 → Should succeed
   - Add 50 to cart, then add 50 more → Should succeed (total = 100)

3. **Multiple items**
   - Each item's minimum is validated independently

4. **Language support**
   - English users see English messages
   - Arabic users see Arabic messages (RTL)

### Manual Testing Steps

1. **In Zoho**: Set "Minimum Quantity Limitation" = `100` on an item
2. **In Console**:
   - Go to product detail page
   - Try to add quantity < 100
   - Verify error alert shows
   - Try to add quantity >= 100
   - Verify success

3. **Shop Listing**:
   - Click "Add to Cart" on product card
   - Verify browser alert shows for items with minimum

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Custom field not set | No restriction (minimum_quantity = undefined) |
| Custom field = 0 | No restriction |
| Custom field = negative | Treated as no restriction |
| Custom field = "invalid" | Treated as no restriction |
| Item already in cart | Validation checks TOTAL quantity (cart + new) |
| Quantity input exceeds max stock | Stock limit takes precedence |

---

## Files Modified

1. `src/types/index.ts` - Type definitions
2. `src/lib/zoho/products.ts` - Product fetching and custom field extraction
3. `src/components/providers/cart-provider.tsx` - Validation logic
4. `src/components/products/product-detail-content.tsx` - UI alerts
5. `src/components/products/product-card.tsx` - Quick add validation
6. `src/messages/en.json` - English translations
7. `src/messages/ar.json` - Arabic translations

---

## API Impact

### Zoho Books API
- **No additional API calls** - Custom fields are included in standard product responses
- Uses existing `/items` endpoint with `custom_fields` in response

### Performance
- **Zero performance impact** - Validation is client-side
- Custom field extraction happens during product fetch (already cached)

---

## Future Enhancements

1. **Suggested Quantity Buttons**
   - Add quick buttons for minimum quantity multiples
   - Example: If minimum = 100, show buttons for 100, 200, 300

2. **Bulk Discount Integration**
   - Show savings when ordering minimum or above
   - Example: "Order 100+ and save 10%"

3. **Inventory Alerts**
   - Warn if available stock < minimum quantity
   - Show "Out of stock for minimum order" message

4. **Analytics**
   - Track how often users hit minimum quantity restrictions
   - Identify products where minimum may be too high

---

## Deployment

### Staging
```bash
git checkout preview
git add -A
git commit -m "feat: add minimum quantity restriction for wholesale items"
git push origin preview
```

### Production (when requested)
```bash
git checkout main
git merge preview
git push origin main
git checkout preview
```

---

## Support

If you encounter issues:

1. **Verify custom field in Zoho**
   - Name must be: "Minimum Quantity Limitation"
   - Value must be a positive integer

2. **Check browser console**
   - Look for validation errors
   - Check cart state

3. **Clear cache**
   - Product data is cached for 24 hours
   - Use `/api/revalidate?tag=products&secret=...` to refresh

---

**Version:** 1.0.0
**Date:** 2026-01-22
**Status:** ✅ Implemented & Tested
