---
name: tsh-stock
description: |
  TSH stock and warehouse logic for Zoho Inventory. Use when:
  (1) Displaying stock levels on product pages
  (2) Understanding warehouse configuration
  (3) Debugging stock display issues (showing 0 when shouldn't)
  (4) Working with "In Stock" / "Out of Stock" badges
  (5) Implementing stock-based filtering
  (6) Understanding the difference between list and detail page stock
---

# TSH Stock Rules

## Warehouse Configuration

| Setting | Value |
|---------|-------|
| **Warehouse Name** | WholeSale WareHouse (Warehouse) |
| **Warehouse ID** | `2646610000000077024` |
| **Stock Type** | Accounting Stock (Available for Sale) |
| **Field** | `location_available_for_sale_stock` |
| **Array** | `locations` (NOT `warehouses`) |

## Stock Formula

```
Available for Sale = Stock on Hand - Committed Stock
```

- **Stock on Hand**: Physical stock in warehouse
- **Committed Stock**: Reserved for pending orders
- **Available for Sale**: What can actually be sold

## Critical: Correct Field Names

```typescript
// CORRECT - Use these
const location = item.locations?.find(
  loc => loc.location_id === '2646610000000077024'
);
const stock = location?.location_available_for_sale_stock;

// WRONG - Never use
item.warehouses                    // Wrong array name
warehouse_available_stock          // Wrong field name
stock_on_hand                      // Includes committed stock
```

## Code Implementation

### Constants
```typescript
// src/lib/zoho/products.ts
export const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';
```

### Stock Extraction Function
```typescript
export function getWholesaleAvailableStock(item: ZohoItem): number {
  const location = item.locations?.find(
    loc => loc.location_id === WHOLESALE_WAREHOUSE_ID
  );

  if (location) {
    return location.location_available_for_sale_stock ?? 0;
  }

  // Fallback to item-level stock
  return item.available_stock ?? 0;
}
```

### Type Definition
```typescript
interface ZohoItem {
  item_id: string;
  name: string;
  available_stock: number;
  locations?: Array<{
    location_id: string;
    location_name: string;
    location_stock_on_hand: number;
    location_available_for_sale_stock: number;
  }>;
}
```

## List vs Detail Page

### Detail Page (Accurate Stock)
- Endpoint: `GET /inventory/v1/items/{item_id}`
- Returns: Full item with `locations` array
- Stock: Accurate per-warehouse breakdown

```typescript
export async function getProduct(itemId: string) {
  const response = await zohoFetch(`/inventory/v1/items/${itemId}`, {
    params: { organization_id: process.env.ZOHO_ORGANIZATION_ID },
  });

  const item = response.item;
  const stock = getWholesaleAvailableStock(item);
  return { ...item, stock };
}
```

### List Page (Filtered Stock)
- Endpoint: `GET /inventory/v1/items`
- Note: Does NOT return `locations` array
- Use `warehouse_id` parameter to filter

```typescript
export async function getAllProductsComplete() {
  const response = await zohoFetch('/inventory/v1/items', {
    params: {
      organization_id: process.env.ZOHO_ORGANIZATION_ID,
      warehouse_id: WHOLESALE_WAREHOUSE_ID,
      status: 'active',
    },
  });

  return response.items.map(item => ({
    ...item,
    stock: item.available_stock ?? 0,
  }));
}
```

## Stock Badge Component

```typescript
'use client';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

export function StockBadge({ stock }: { stock: number }) {
  const t = useTranslations('products');

  if (stock > 10) {
    return <Badge variant="default">{t('inStock')}</Badge>;
  }

  if (stock > 0) {
    return (
      <Badge variant="warning">
        {t('lowStock', { count: stock })}
      </Badge>
    );
  }

  return <Badge variant="secondary">{t('outOfStock')}</Badge>;
}
```

## Translations

```json
// en.json
{
  "products": {
    "inStock": "In Stock",
    "outOfStock": "Out of Stock",
    "lowStock": "Only {count} left",
    "available": "available"
  }
}

// ar.json
{
  "products": {
    "inStock": "متوفر",
    "outOfStock": "غير متوفر",
    "lowStock": "متبقي {count} فقط",
    "available": "متاح"
  }
}
```

## Product Card with Stock

```typescript
export function ProductCard({ product }) {
  const t = useTranslations('products');

  return (
    <Card>
      <CardContent>
        <h3>{product.name}</h3>
        <div className="flex items-center gap-2 mt-2">
          {product.stock > 0 ? (
            <>
              <span className="text-green-600">{t('inStock')}</span>
              <span className="text-sm text-muted-foreground">
                ({product.stock} {t('available')})
              </span>
            </>
          ) : (
            <span className="text-red-600">{t('outOfStock')}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Stock shows 0 | Wrong field | Use `location_available_for_sale_stock` |
| Stock shows 0 | Wrong array | Use `locations` not `warehouses` |
| Stock shows 0 | Wrong warehouse | Use ID `2646610000000077024` |
| Stock shows 0 | All committed | Stock reserved for orders |
| Not updating | Cache stale | Revalidate products cache |
| Different list/detail | List lacks locations | Expected - use warehouse_id filter |

## Debug Commands

```bash
# Check stock data
curl "https://www.tsh.sale/api/debug/stock"

# Revalidate product cache
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

## Other Warehouses (DO NOT USE)

| Warehouse | Purpose |
|-----------|---------|
| TSH WholeSale Sales | Sales fulfillment |
| Retail WareHouse | Retail store |
| TSH Retail Store | Display stock |

Only use **WholeSale WareHouse** (`2646610000000077024`) for B2B display.

## Checklist

- [ ] Import `WHOLESALE_WAREHOUSE_ID` from products.ts
- [ ] Use `getWholesaleAvailableStock()` for detail pages
- [ ] Use `warehouse_id` filter for list pages
- [ ] Handle 0 stock with "Out of Stock" badge
- [ ] Add stock translations (en.json, ar.json)
