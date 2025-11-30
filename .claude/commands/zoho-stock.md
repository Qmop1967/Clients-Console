Stock calculation rules and warehouse info for TSH Clients Console.

## Warehouse Configuration

| Field | Value |
|-------|-------|
| **Warehouse Name** | WholeSale WareHouse (Warehouse) |
| **Warehouse ID** | `2646610000000077024` |
| **Stock Type** | Accounting Stock (Available for Sale) |

## Stock Formula

```
Available for Sale = Stock on Hand - Committed Stock
```

## CRITICAL: Correct Field & Array

```typescript
// CORRECT - Use these:
const location = item.locations?.find(
  loc => loc.location_id === '2646610000000077024'
);
const stock = location?.location_available_for_sale_stock;

// WRONG - Never use these:
// item.warehouses (wrong array name)
// warehouse_available_stock (wrong field name)
// stock_on_hand (includes committed stock)
```

## Code Location

```
src/lib/zoho/products.ts
├── WHOLESALE_WAREHOUSE_ID = '2646610000000077024'
├── getWholesaleAvailableStock(item) → Extracts correct stock
├── getProduct(id) → Single item with locations array
└── getAllProductsComplete() → List with warehouse_id filter
```

## Stock Extraction Function

```typescript
export function getWholesaleAvailableStock(item: ZohoItem): number {
  const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

  // Find in locations array (NOT warehouses)
  const location = item.locations?.find(
    loc => loc.location_id === WHOLESALE_WAREHOUSE_ID
  );

  // Use location_available_for_sale_stock
  return location?.location_available_for_sale_stock ?? item.available_stock ?? 0;
}
```

## Debug

```bash
# Check stock values
curl "https://www.tsh.sale/api/debug/stock"

# Revalidate stock cache
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

## Stock Showing 0 Troubleshooting

1. **Wrong warehouse** → Verify using WholeSale WareHouse ID
2. **Wrong field** → Must use `location_available_for_sale_stock`
3. **Wrong array** → Must use `locations` not `warehouses`
4. **List vs Detail** → List page may not have locations data
5. **Committed stock** → All stock may be committed in Zoho

## Zoho Inventory Check

1. Go to Zoho Inventory → Items → Find item
2. Click item to view details
3. Check "Stock on Hand" and "Committed Stock"
4. Available = Stock on Hand - Committed

## Other Warehouses (DO NOT USE for public display)

| Warehouse | ID | Notes |
|-----------|-----|-------|
| TSH WholeSale Sales | Different ID | Sales warehouse |
| Retail WareHouse | Different ID | Retail only |
| TSH Retail Store | Different ID | Store display |
