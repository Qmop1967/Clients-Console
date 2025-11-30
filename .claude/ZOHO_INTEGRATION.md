# TSH Clients Console - Zoho Integration Reference

Complete reference for Zoho Books and Zoho Inventory API integration.

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Request for Zoho Data                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Check In-Memory Cache (fastest)                             │
│     - Works within single serverless invocation only            │
└─────────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Check Upstash Redis (PRIMARY)                               │
│     - REST API: https://fine-mole-41883.upstash.io              │
│     - TTL: 50 minutes                                           │
│     - Persists across serverless invocations                    │
└─────────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Rate Limit Guard                                            │
│     - 10-second minimum between refresh attempts                │
│     - Prevents Zoho OAuth rate limiting                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Refresh Token from Zoho OAuth                               │
│     - POST https://accounts.zoho.com/oauth/v2/token             │
│     - On success: Save to ALL caches                            │
│     - On rate limit: Wait 10s and retry once                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints Reference

### Zoho Inventory API
Base URL: `https://www.zohoapis.com/inventory/v1`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/items` | GET | List all products |
| `/items/{item_id}` | GET | Get single product with locations |
| `/categories` | GET | List categories |
| `/pricebooks` | GET | List price books |
| `/pricebooks/{id}` | GET | Get pricebook with items |

### Zoho Books API
Base URL: `https://www.zohoapis.com/books/v3`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/contacts` | GET | List customers |
| `/contacts/{id}` | GET | Get customer details |
| `/salesorders` | GET | List sales orders |
| `/invoices` | GET | List invoices |
| `/customerpayments` | GET | List payments |
| `/creditnotes` | GET | List credit notes |

---

## Common Query Parameters

```typescript
// All endpoints require
organization_id: '748369814'

// Pagination
page: 1
per_page: 100  // Max 200

// Filtering (items)
category_id: string
status: 'active' | 'inactive'
warehouse_id: '2646610000000077024'  // For stock filtering

// Filtering (orders/invoices)
customer_id: string
status: string
date_start: 'YYYY-MM-DD'
date_end: 'YYYY-MM-DD'
```

---

## Code Files

| File | Purpose |
|------|---------|
| `src/lib/zoho/client.ts` | OAuth client, token management, API wrapper |
| `src/lib/zoho/products.ts` | Products, stock extraction |
| `src/lib/zoho/price-lists.ts` | Price list constants, price fetching |
| `src/lib/zoho/customers.ts` | Customer lookup |
| `src/lib/zoho/orders.ts` | Sales orders |
| `src/lib/zoho/invoices.ts` | Invoices |
| `src/lib/zoho/payments.ts` | Payments |
| `src/lib/zoho/credit-notes.ts` | Credit notes |
| `src/lib/zoho/stock-cache.ts` | Redis stock caching |

---

## Using zohoFetch

```typescript
import { zohoFetch } from '@/lib/zoho/client';

// GET request
const products = await zohoFetch('/inventory/v1/items', {
  params: {
    organization_id: process.env.ZOHO_ORGANIZATION_ID,
    page: 1,
    per_page: 100,
  },
});

// With caching
import { unstable_cache } from 'next/cache';

const getCachedProducts = unstable_cache(
  async () => {
    return await zohoFetch('/inventory/v1/items', { ... });
  },
  ['products'],
  { revalidate: 3600, tags: ['products'] }
);
```

---

## Price Lists (6 Active)

| ID | Name | Currency | Use Case |
|-----|------|----------|----------|
| `2646610000049149103` | Consumer | IQD | Public visitors |
| `2646610000004453985` | Retailor | USD | Retail shops |
| `2646610000057419683` | Technical IQD | IQD | Technicians |
| `2646610000045742089` | Technical USD | USD | Technicians |
| `2646610000004152175` | Wholesale A | USD | Cash wholesale |
| `2646610000004453961` | Wholesale B | USD | Credit wholesale |

### Fetching Prices

```typescript
import { PRICE_LIST_IDS, getPriceList } from '@/lib/zoho/price-lists';

// Fetch full pricebook with items
const pricebook = await getPriceList(PRICE_LIST_IDS.CONSUMER);

// Extract price for specific item
const itemPrice = pricebook.pricebook_items.find(
  item => item.item_id === productId
);

if (itemPrice) {
  const price = itemPrice.pricebook_rate;
  const currency = pricebook.currency_code; // IQD or USD
} else {
  // Item not in pricebook - show "Contact for price"
}
```

---

## Stock Extraction

### Warehouse Configuration
- **Name**: WholeSale WareHouse (Warehouse)
- **ID**: `2646610000000077024`
- **Stock Type**: Available for Sale (Accounting Stock)

### Code Pattern

```typescript
export function getWholesaleAvailableStock(item: ZohoItem): number {
  const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

  // CRITICAL: Use locations array, NOT warehouses
  const location = item.locations?.find(
    loc => loc.location_id === WHOLESALE_WAREHOUSE_ID
  );

  // CRITICAL: Use location_available_for_sale_stock
  return location?.location_available_for_sale_stock ?? item.available_stock ?? 0;
}
```

### Stock Formula
```
Available for Sale = Stock on Hand - Committed Stock
```

---

## Webhook Events

Endpoint: `/api/webhooks/zoho`

| Event | Action |
|-------|--------|
| `item.created` | Revalidate products |
| `item.updated` | Revalidate products |
| `item.deleted` | Revalidate products |
| `salesorder.created` | Revalidate orders |
| `salesorder.updated` | Revalidate orders |
| `invoice.created` | Revalidate invoices |
| `invoice.updated` | Revalidate invoices |
| `invoice.paid` | Revalidate invoices |
| `payment.created` | Revalidate payments |
| `payment.updated` | Revalidate payments |
| `creditnote.created` | Revalidate credit notes |
| `creditnote.updated` | Revalidate credit notes |

---

## Error Handling

```typescript
try {
  const data = await zohoFetch('/inventory/v1/items', { ... });
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('401')) {
      // Token expired - will auto-refresh
    } else if (error.message.includes('429')) {
      // Rate limited - wait and retry
    } else if (error.message.includes('404')) {
      // Resource not found
    }
  }
  throw error;
}
```

---

## Rate Limits

| API | Limit |
|-----|-------|
| OAuth Token Refresh | ~100/minute |
| Inventory API | 100 requests/minute |
| Books API | 100 requests/minute |

### Handling Rate Limits

1. **Token caching** - Upstash Redis prevents excessive refreshes
2. **Data caching** - unstable_cache reduces API calls
3. **Rate limit guard** - 10-second minimum between token refreshes
4. **Exponential backoff** - Retry with increasing delays

---

## Environment Variables

```bash
# Zoho OAuth
ZOHO_CLIENT_ID=<client_id>
ZOHO_CLIENT_SECRET=<client_secret>
ZOHO_REFRESH_TOKEN=<refresh_token>
ZOHO_ORGANIZATION_ID=748369814

# Token Caching (CRITICAL)
UPSTASH_REDIS_REST_URL=https://fine-mole-41883.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

---

## Generating New Refresh Token

If refresh token expires:

1. Go to Zoho API Console: https://api-console.zoho.com/
2. Select your application
3. Generate new refresh token with scopes:
   - `ZohoInventory.fullaccess.all`
   - `ZohoBooks.fullaccess.all`
4. Update ZOHO_REFRESH_TOKEN in Vercel
5. Redeploy
