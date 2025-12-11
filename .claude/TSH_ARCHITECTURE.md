# TSH Clients Console - System Architecture

**Complete technical architecture for TSH Clients Console B2B Portal**

---

## 1. Project Overview

| Attribute | Value |
|-----------|-------|
| **Project Name** | TSH Clients Console |
| **Type** | B2B Wholesale Client Portal |
| **Company** | TSH (Tech Spider Hand) |
| **Stack** | Next.js 15, TypeScript, TailwindCSS, shadcn/ui |
| **Integration** | Zoho Books & Zoho Inventory APIs |
| **Deployment** | Vercel (staging.tsh.sale → www.tsh.sale) |

### Purpose

Self-service portal for TSH wholesale clients (retailers, technicians, resellers) to:
- Browse product catalog with real-time stock
- View customer-specific pricing
- Place orders
- Track order history, invoices, payments
- Manage their accounts

---

## 2. Zoho Locations Structure

### Organization: TSH (ID: 748369814)

```
TSH COMPANY - ZOHO LOCATIONS HIERARCHY
│
├── 📍 MAIN TSH BUSINESS ⭐ (Primary Business Location)
│   │   Type: Business
│   │   Address: Baghdad, Iraq
│   │   Default Transaction Series: Yes
│   │
│   ├── 🏭 MAIN WAREHOUSE 🔒
│   │       Type: Warehouse
│   │       ID: 2646610000000077024
│   │       Address: AL-DORA, Baghdad, Iraq
│   │       Purpose: B2B wholesale inventory
│   │       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│   │       ✅ TSH CLIENTS CONSOLE USES THIS
│   │       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│   │
│   ├── 🏭 inactive 1 (Warehouse) ❌
│   │       Status: Inactive - Not used
│   │
│   └── 🏭 inactive 2 (Warehouse) ❌
│           Status: Inactive - Test data
│
└── 📍 TSH RETAIL DORA (Business Location)
    │   Type: Business
    │   Address: Iraq
    │   Purpose: Retail shop operations
    │
    └── 🏪 DORA STORE
            Type: Warehouse
            Address: AL-DORA, Baghdad, Iraq
            Purpose: Retail shop inventory
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ❌ NOT USED BY THIS CONSOLE
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Location Types Explained

| Type | Purpose | Can Be Parent |
|------|---------|---------------|
| **Business** | Operational/legal division | ✅ Yes |
| **Warehouse** | Physical storage location | ❌ No (always child) |

---

## 3. Stock Architecture

### Stock Source (CRITICAL)

```
┌─────────────────────────────────────────────────────────────┐
│                    STOCK SOURCE RULE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  This console ONLY uses stock from:                        │
│                                                             │
│  📦 Warehouse: Main WareHouse                              │
│  🔑 ID: 2646610000000077024                                │
│  📍 Location: AL-DORA, Baghdad, Iraq                       │
│                                                             │
│  Field: location_available_for_sale_stock                  │
│  Array: locations[] (NOT warehouses[])                     │
│                                                             │
│  Formula:                                                   │
│  Available for Sale = Stock on Hand - Committed Stock      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ NEVER USE:                                             │
│  - item.available_stock (combines ALL warehouses)          │
│  - Dora Store stock                                        │
│  - Any other location's stock                              │
└─────────────────────────────────────────────────────────────┘
```

### Stock Extraction Logic

```typescript
// src/lib/zoho/stock-cache.ts
const WHOLESALE_LOCATION_NAME = 'Main WareHouse';
const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

function getWholesaleAvailableStock(item: ZohoItemWithLocations): number {
  if (item.locations && item.locations.length > 0) {
    const wholesaleLocation = item.locations.find(
      (loc) => loc.location_name === WHOLESALE_LOCATION_NAME
    );

    if (wholesaleLocation) {
      return wholesaleLocation.location_available_for_sale_stock || 0;
    }
  }
  return 0; // NEVER fall back to item.available_stock
}
```

### Stock Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STOCK DATA FLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ZOHO BOOKS/INVENTORY                                                   │
│  ─────────────────────                                                  │
│       │                                                                 │
│       │ GET /items/{id} (includes locations array)                     │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Item Response                                                    │   │
│  │ {                                                                │   │
│  │   "item_id": "123456",                                          │   │
│  │   "available_stock": 525,  ← TOTAL (all locations) - DON'T USE │   │
│  │   "locations": [                                                │   │
│  │     {                                                           │   │
│  │       "location_name": "Main WareHouse",                        │   │
│  │       "location_available_for_sale_stock": 500  ← USE THIS     │   │
│  │     },                                                          │   │
│  │     {                                                           │   │
│  │       "location_name": "Dora Store",                            │   │
│  │       "location_available_for_sale_stock": 25  ← IGNORE        │   │
│  │     }                                                           │   │
│  │   ]                                                             │   │
│  │ }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│       │                                                                 │
│       │ Extract Main WareHouse stock                                   │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ UPSTASH REDIS CACHE                                             │   │
│  │ Key: stock:wholesale_map                                        │   │
│  │ TTL: 4 hours                                                    │   │
│  │ Value: { "123456": 500, "789012": 200, ... }                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│       │                                                                 │
│       │ getUnifiedStock() / getUnifiedStockBulk()                      │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ FRONTEND DISPLAY                                                │   │
│  │ - Shop listing: 500 in stock                                   │   │
│  │ - Product detail: 500 in stock                                 │   │
│  │ - Cart: Check stock before checkout                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Stock Synchronization Architecture

### Multi-Layer Sync System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STOCK SYNC ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAYER 1: WEBHOOK-DRIVEN (Primary - Instant)                           │
│  ════════════════════════════════════════════                          │
│  Trigger: Zoho transaction (invoice, bill, etc.)                       │
│  Endpoint: POST /api/webhooks/zoho                                     │
│  Latency: < 5 seconds                                                  │
│  │                                                                      │
│  │  Zoho Transaction                                                   │
│  │       ↓                                                             │
│  │  Webhook sent to /api/webhooks/zoho                                │
│  │       ↓                                                             │
│  │  Parse payload → Extract item IDs                                  │
│  │       ↓                                                             │
│  │  quickSyncStock(itemIds)                                           │
│  │       ↓                                                             │
│  │  Fetch from Books API → Update Redis → Revalidate ISR              │
│  │                                                                      │
│  LAYER 2: PERIODIC SYNC (Backup - Every 15 minutes)                    │
│  ══════════════════════════════════════════════════                    │
│  Trigger: Vercel Cron Job                                              │
│  Endpoint: POST /api/sync/stock                                        │
│  Purpose: Catch any missed webhooks, ensure freshness                  │
│  │                                                                      │
│  │  Cron fires every 15 minutes                                        │
│  │       ↓                                                             │
│  │  Check cache age (skip if < 10 min old)                            │
│  │       ↓                                                             │
│  │  syncStockFromBooks() → Full sync all items                        │
│  │       ↓                                                             │
│  │  Update Redis cache                                                 │
│  │                                                                      │
│  LAYER 3: ON-DEMAND SYNC (Manual/Recovery)                             │
│  ═════════════════════════════════════════                             │
│  Trigger: Admin API call or Claude command                             │
│  Endpoint: GET /api/sync/stock?action=sync&force=true                  │
│  Purpose: Recovery from failures, manual refresh                       │
│  │                                                                      │
│  │  Admin triggers sync                                                │
│  │       ↓                                                             │
│  │  Skip freshness check (force=true)                                 │
│  │       ↓                                                             │
│  │  Full sync → Update Redis                                          │
│  │                                                                      │
│  LAYER 4: HEALTH MONITORING (Continuous)                               │
│  ════════════════════════════════════════                              │
│  Endpoint: GET /api/sync/stock?action=status                           │
│  Checks: Cache exists, item count, freshness                           │
│  Alert: If itemCount < 100 or cache > 4 hours old                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Transactions That Affect Stock

| Transaction | Effect | Webhook Event | Handler |
|-------------|--------|---------------|---------|
| **Invoice Created** | ⬇️ Stock decreases | `invoice.created` | ✅ Implemented |
| **Invoice Updated** | 🔄 May change | `invoice.updated` | ✅ Implemented |
| **Bill Created** | ⬆️ Stock increases | `bill.created` | ✅ Implemented |
| **Bill Updated** | 🔄 May change | `bill.updated` | ✅ Implemented |
| **Sales Order Created** | 🔒 Commits stock | `salesorder.created` | ✅ Implemented |
| **Sales Order Updated** | 🔄 Committed changes | `salesorder.updated` | ✅ Implemented |
| **Sales Order Cancelled** | 🔓 Releases committed | `salesorder.deleted` | ✅ Implemented |
| **Credit Note Created** | ⬆️ Stock increases (returns) | `creditnote.created` | ✅ Implemented |
| **Inventory Adjustment** | ⬆️⬇️ Changes | `inventoryadjustment.created` | ✅ Implemented |
| **Sales Return Received** | ⬆️ Stock increases | `salesreturnreceive.created` | ✅ Implemented |
| **Package Shipped** | ⬇️ Physical stock | `package.shipped` | ✅ Implemented |
| **Item Updated** | 🔄 May change | `item.updated` | ✅ Implemented |

---

## 5. Price List Architecture

### Available Price Lists

| Price List | ID | Currency | Use Case |
|------------|-----|----------|----------|
| **Consumer** | `2646610000049149103` | IQD | Public visitors (default) |
| **Retailor USD** | `2646610000004453985` | USD | Retail shops |
| **Retailor IQD** | `2646610000113426769` | IQD | Retail shops |
| **Technical USD** | `2646610000045742089` | USD | Technicians |
| **Technical IQD** | `2646610000057419683` | IQD | Technicians |
| **Wholesale A USD** | `2646610000004152175` | USD | Cash wholesale |
| **Wholesale A IQD** | `2646610000113417534` | IQD | Cash wholesale |
| **Wholesale B USD** | `2646610000004453961` | USD | Credit wholesale |
| **Wholesale B IQD** | `2646610000113426003` | IQD | Credit wholesale |

### Price Resolution Flow

```
User Type                  Price List Used
─────────────────────────────────────────
Public Visitor      →     Consumer (IQD)
Authenticated User  →     Customer's assigned price_list_id
                          OR fallback to Consumer (IQD)
```

---

## 6. Caching Architecture

### Cache Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CACHING ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAYER 1: NEXT.JS ISR (unstable_cache)                                 │
│  ─────────────────────────────────────                                 │
│  Purpose: Server-side page/data caching                                │
│  │                                                                      │
│  ├── Products metadata: 24 hours                                       │
│  ├── Categories: 24 hours                                              │
│  ├── Price lists: 1 hour                                               │
│  └── Customer data: 5 minutes                                          │
│                                                                         │
│  LAYER 2: UPSTASH REDIS                                                │
│  ───────────────────────                                               │
│  Purpose: Persistent cross-request caching                             │
│  │                                                                      │
│  ├── stock:wholesale_map - Stock cache (4 hours TTL)                  │
│  ├── zoho:access_token - OAuth token (50 minutes TTL)                 │
│  └── stock:sync_lock - Sync lock (10 minutes TTL)                     │
│                                                                         │
│  LAYER 3: IN-MEMORY                                                    │
│  ──────────────────                                                    │
│  Purpose: Per-request caching (serverless function lifetime)           │
│  │                                                                      │
│  └── OAuth token (within same invocation)                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Redis Keys

| Key | Purpose | TTL |
|-----|---------|-----|
| `stock:wholesale_map` | Main WareHouse stock cache | 4 hours |
| `stock:sync_lock` | Prevent concurrent syncs | 10 minutes |
| `zoho:access_token` | OAuth access token | 50 minutes |

---

## 7. API Routes

### Public Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | * | Authentication |
| `/api/webhooks/zoho` | POST | Zoho webhook handler |

### Admin Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/revalidate` | GET | Manual cache revalidation |
| `/api/sync/stock` | GET/POST | Stock sync management |
| `/api/debug/token` | GET | Token debugging |
| `/api/debug/prices` | GET | Price debugging |
| `/api/debug/stock` | GET | Stock debugging |

---

## 8. Error Handling

### Stock Unavailable Scenarios

| Scenario | Behavior |
|----------|----------|
| Redis cache miss | Fetch from Books API (detail page) |
| Books API rate limited | Return 0, log error |
| Books API error | Return 0, log error |
| Empty cache | Show "Stock unavailable" message |

### Graceful Degradation

```typescript
// If stock cannot be determined, show appropriate message
if (stock === null || source === 'unavailable') {
  return <Badge variant="warning">Check availability</Badge>;
}

// Only show "Out of Stock" if we KNOW stock is 0
if (stock === 0) {
  return <Badge variant="destructive">Out of Stock</Badge>;
}
```

---

## 9. Monitoring & Health Checks

### Stock Cache Health

```bash
# Check cache status
curl "https://www.tsh.sale/api/sync/stock?action=status"

# Response:
{
  "exists": true,
  "itemCount": 1300,
  "ageSeconds": 1800,
  "isStale": false
}
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|-----------|---------|---------|----------|
| Item Count | > 400 | 100-400 | < 100 |
| Cache Age | < 2 hours | 2-4 hours | > 4 hours |
| Sync Errors | 0 | 1-5 | > 5 |

---

## 10. Security

### API Authentication

| API | Authentication |
|-----|----------------|
| Zoho Books/Inventory | OAuth 2.0 (refresh token) |
| Webhook | Signature verification (if configured) |
| Sync endpoint | Secret parameter |
| Revalidate endpoint | Secret parameter |

### Secrets

| Secret | Storage | Purpose |
|--------|---------|---------|
| `ZOHO_CLIENT_SECRET` | Vercel Env | OAuth |
| `ZOHO_REFRESH_TOKEN` | Vercel Env | OAuth |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel Env | Redis |
| `ZOHO_WEBHOOK_SECRET` | Vercel Env | Webhook verification |

---

## 11. Deployment

### Branch Strategy

```
preview branch → staging.tsh.sale (automatic)
main branch → www.tsh.sale (manual trigger only)
```

### Deployment Checklist (Stock-Related Changes)

- [ ] Run `npm run typecheck`
- [ ] Verify warehouse name matches Zoho
- [ ] Run full stock sync after deploy
- [ ] Verify shop page stock display
- [ ] Verify detail page stock display
- [ ] Confirm list/detail stock consistency

---

**Last Updated:** 2025-12-11
**Version:** 1.0.0
