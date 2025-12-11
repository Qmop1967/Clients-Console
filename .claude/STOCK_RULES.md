# TSH Clients Console - Stock Rules

Complete stock display logic with code examples for Main WareHouse.

---

## Warehouse Configuration

| Setting | Value |
|---------|-------|
| **Warehouse Name** | `Main WareHouse` |
| **Warehouse ID** | `2646610000000077024` |
| **Business Location** | Main TSH Business |
| **Stock Type** | Accounting Stock (Available for Sale) |
| **Field** | `location_available_for_sale_stock` |
| **Array** | `locations` (NOT `warehouses`) |
| **Address** | AL-DORA, Baghdad, Iraq |

---

## Stock Formula

```
Available for Sale = Stock on Hand - Committed Stock
```

- **Stock on Hand**: Physical stock in warehouse
- **Committed Stock**: Reserved for pending orders
- **Available for Sale**: What can actually be sold

---

## Critical: Correct Field & Array

```typescript
// ✅ CORRECT - Use these
const WHOLESALE_LOCATION_NAME = 'Main WareHouse';
const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

const location = item.locations?.find(
  loc => loc.location_name === WHOLESALE_LOCATION_NAME
);
const stock = location?.location_available_for_sale_stock;

// ❌ WRONG - Never use these
item.warehouses                    // Wrong array name
warehouse_available_stock          // Wrong field name
stock_on_hand                      // Includes committed stock
item.available_stock               // Combines ALL warehouses (Main + Dora)
```

---

## Code Implementation

### Constants

```typescript
// src/lib/zoho/stock-cache.ts & src/lib/zoho/products.ts
const WHOLESALE_LOCATION_NAME = 'Main WareHouse';
const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';
```

### Stock Extraction Function

```typescript
// src/lib/zoho/stock-cache.ts
function getWholesaleAvailableStock(item: ZohoItemWithLocations): number {
  const WHOLESALE_LOCATION_NAME = 'Main WareHouse';

  if (item.locations && item.locations.length > 0) {
    const wholesaleLocation = item.locations.find(
      (loc) => loc.location_name === WHOLESALE_LOCATION_NAME
    );

    if (wholesaleLocation) {
      return wholesaleLocation.location_available_for_sale_stock || 0;
    }
  }
  // NEVER fall back to item.available_stock (combines all warehouses)
  return 0;
}
```

### Unified Stock Functions (ALWAYS USE THESE)

```typescript
// For single item (detail page)
const { stock, source } = await getUnifiedStock(itemId, {
  fetchOnMiss: true,
  context: 'product-detail',
});

// For multiple items (list page)
const stockMap = await getUnifiedStockBulk(itemIds, {
  context: 'shop-list',
});
```

### ZohoItem Type Definition

```typescript
interface ZohoItem {
  item_id: string;
  name: string;
  sku: string;
  available_stock: number;
  stock_on_hand: number;
  locations?: Array<{
    location_id: string;
    location_name: string;
    location_stock_on_hand: number;
    location_available_for_sale_stock: number;
  }>;
  // ... other fields
}
```

---

## List vs Detail Page

### Detail Page (Accurate Stock)
- Endpoint: `GET /inventory/v1/items/{item_id}`
- Returns: Full item with `locations` array
- Stock: Accurate per-warehouse breakdown

```typescript
export async function getProduct(itemId: string) {
  const response = await zohoFetch(`/inventory/v1/items/${itemId}`, {
    params: {
      organization_id: process.env.ZOHO_ORGANIZATION_ID,
    },
  });

  const item = response.item;
  const stock = getWholesaleAvailableStock(item);

  return { ...item, stock };
}
```

### List Page (Filtered Stock)
- Endpoint: `GET /inventory/v1/items`
- Note: List endpoint does NOT return `locations` array
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

---

## Component Usage

### Stock Badge

```typescript
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface StockBadgeProps {
  stock: number;
}

export function StockBadge({ stock }: StockBadgeProps) {
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

### Translations

```json
// en.json
{
  "products": {
    "inStock": "In Stock",
    "outOfStock": "Out of Stock",
    "lowStock": "Only {count} left"
  }
}

// ar.json
{
  "products": {
    "inStock": "متوفر",
    "outOfStock": "غير متوفر",
    "lowStock": "متبقي {count} فقط"
  }
}
```

---

## Stock Display in Product Card

```typescript
interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  currency: string;
}

export function ProductCard({ product }: { product: Product }) {
  const t = useTranslations('products');

  return (
    <Card>
      <CardContent>
        <h3>{product.name}</h3>

        {/* Price */}
        <p className="text-lg font-bold">
          {product.price.toLocaleString()} {product.currency}
        </p>

        {/* Stock */}
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

---

## Stock Caching

### Redis Cache (src/lib/zoho/stock-cache.ts)

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCachedStock(itemId: string): Promise<number | null> {
  const cached = await redis.get<number>(`stock:${itemId}`);
  return cached;
}

export async function setCachedStock(itemId: string, stock: number): Promise<void> {
  await redis.set(`stock:${itemId}`, stock, { ex: 300 }); // 5 min TTL
}
```

### Cache Invalidation

Stock cache is invalidated on:
1. Webhook: `item.updated` event
2. Daily cron: `/api/sync/stock` at 06:00 UTC
3. Manual: `/api/revalidate?tag=products`

---

## Debugging Stock

### Debug Endpoint

```bash
curl "https://www.tsh.sale/api/debug/stock"
```

### Check in Zoho

1. Go to Zoho Inventory
2. Items → Find product
3. Click to view details
4. Check "Stock on Hand" and "Committed Stock"
5. Available = Stock on Hand - Committed

### Revalidate Cache

```bash
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Stock shows 0 | Wrong field | Use `location_available_for_sale_stock` |
| Stock shows 0 | Wrong array | Use `locations` not `warehouses` |
| Stock shows 0 | Wrong warehouse | Use ID `2646610000000077024` |
| Stock shows 0 | All committed | Check Zoho, stock is reserved |
| Stock not updating | Cache stale | Revalidate products cache |
| Different on list/detail | List lacks locations | Expected behavior |

---

## Other Locations (DO NOT USE FOR THIS CONSOLE)

| Location | Type | Purpose | Use |
|----------|------|---------|-----|
| **Main WareHouse** | Warehouse | B2B wholesale | ✅ THIS CONSOLE |
| Dora Store | Warehouse | Retail shop | ❌ EndUser Console |
| inactive 1/2 | Warehouse | Inactive | ❌ Delete |

Only use **Main WareHouse** (`2646610000000077024`) for this B2B console.

---

## Stock Sync Architecture

### Multi-Layer Synchronization

```
LAYER 1: WEBHOOKS (Instant, < 5 seconds)
├── Zoho transaction triggers webhook
├── POST /api/webhooks/zoho
├── quickSyncStock(itemIds)
└── Update Redis + Revalidate ISR

LAYER 2: PERIODIC SYNC (Every 15 minutes)
├── Vercel Cron job
├── POST /api/sync/stock
├── syncStockFromBooks()
└── Full cache refresh

LAYER 3: ON-DEMAND SYNC (Manual)
├── Admin trigger
├── GET /api/sync/stock?action=sync&force=true
└── Immediate full refresh

LAYER 4: HEALTH MONITORING (Continuous)
├── GET /api/sync/stock?action=status
├── Check: itemCount > 400
├── Check: cache age < 4 hours
└── Alert if unhealthy
```

### Transactions That Affect Stock

| Transaction | Effect | Webhook |
|-------------|--------|---------|
| Invoice Created | ⬇️ Decreases | `invoice.created` |
| Bill Created | ⬆️ Increases | `bill.created` |
| Sales Order | 🔒 Commits | `salesorder.created` |
| Credit Note | ⬆️ May increase | `creditnote.created` |
| Inventory Adjustment | ⬆️⬇️ Changes | `inventoryadjustment.created` |
| Sales Return Received | ⬆️ Increases | `salesreturnreceive.created` |
| Package Shipped | ⬇️ Physical stock | `package.shipped` |
| Item Updated | 🔄 May change | `item.updated` |

### Stock Sync Commands

```bash
# Check cache status
curl "https://www.tsh.sale/api/sync/stock?action=status"

# Force full sync
curl "https://www.tsh.sale/api/sync/stock?action=sync&secret=tsh-stock-sync-2024&force=true"

# Revalidate caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```

---

## Golden Rules (NEVER Break)

1. **Single Source of Truth**: Always use `getUnifiedStock()` or `getUnifiedStockBulk()`
2. **Warehouse Isolation**: Only show Main WareHouse stock
3. **No Fallbacks**: Never use `item.available_stock` as fallback
4. **Consistency**: List and detail pages must show same stock
5. **Graceful Degradation**: Show "Check availability" if stock unavailable

---

**Last Updated:** 2025-12-11
