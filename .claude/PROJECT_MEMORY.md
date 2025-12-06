# TSH Clients Console - Project Memory

**READ THIS FILE AT THE START OF EVERY SESSION**

This file contains critical information that Claude must memorize for effective work on the TSH Clients Console project.

---

## Critical IDs (MEMORIZE THESE)

| Entity | ID | Usage |
|--------|-----|-------|
| **Organization ID** | `748369814` | All Zoho API calls |
| **WholeSale Warehouse ID** | `2646610000000077024` | Stock source |
| **Consumer Price List** | `2646610000049149103` | Public visitors (IQD) |
| **Retailor Price List** | `2646610000004453985` | Retail shops (USD) |
| **Technical IQD Price List** | `2646610000057419683` | Technicians (IQD) |
| **Technical USD Price List** | `2646610000045742089` | Technicians (USD) |
| **Wholesale A Price List** | `2646610000004152175` | Cash wholesale (USD) |
| **Wholesale B Price List** | `2646610000004453961` | Credit wholesale (USD) |

---

## Golden Rules (NEVER VIOLATE)

### 1. Pricing Rule
```
NEVER show item.rate (base sell price)
ALWAYS use pricebook price from appropriate price list
If item not in pricebook → show "Contact for price" (NOT 0)
```

### 2. Stock Rule
```
Field: location_available_for_sale_stock
Array: locations (NOT warehouses)
Warehouse: WholeSale WareHouse (Warehouse)
Formula: Available = Stock on Hand - Committed Stock
```

### 3. Public Visitors
```
Price List: Consumer (IQD) - ID: 2646610000049149103
Currency: Iraqi Dinar (IQD)
```

### 4. Token Caching
```
Storage: Upstash Redis (https://fine-mole-41883.upstash.io)
TTL: 50 minutes
Prevents: Zoho OAuth rate limiting
If broken → All prices show "Contact for price"
```

### 5. Deployment
```
Staging: Push to `preview` branch → staging.tsh.sale
Production: Push to `main` branch → www.tsh.sale (ONLY when user requests)
Method: GitHub Actions (NOT Vercel CLI)
```

---

## File Quick Reference

### Zoho Integration
| File | Purpose |
|------|---------|
| `src/lib/zoho/client.ts` | OAuth client, token caching, API wrapper |
| `src/lib/zoho/products.ts` | Product/item API, stock extraction |
| `src/lib/zoho/price-lists.ts` | Price list constants, price fetching |
| `src/lib/zoho/stock-cache.ts` | Redis stock caching |
| `src/lib/zoho/customers.ts` | Customer lookup |
| `src/lib/zoho/orders.ts` | Sales orders |
| `src/lib/zoho/invoices.ts` | Invoices |
| `src/lib/zoho/payments.ts` | Payments |
| `src/lib/zoho/credit-notes.ts` | Credit notes |

### Translations
| File | Language |
|------|----------|
| `src/messages/en.json` | English (LTR) |
| `src/messages/ar.json` | Arabic (RTL) |

### Key Components
| File | Purpose |
|------|---------|
| `src/components/products/product-card.tsx` | Product display card |
| `src/components/products/public-products-content.tsx` | Public shop listing |
| `src/components/products/product-detail-content.tsx` | Single product page |

### API Routes
| Route | Purpose |
|-------|---------|
| `/api/auth/[...nextauth]` | Authentication |
| `/api/webhooks/zoho` | Zoho webhook handler |
| `/api/revalidate` | Manual cache revalidation |
| `/api/debug/token` | Token debugging |
| `/api/debug/prices` | Price debugging |
| `/api/debug/stock` | Stock debugging |

---

## Debug Endpoints

```bash
# Test token caching
curl "https://www.tsh.sale/api/debug/token"

# Test price fetching
curl "https://www.tsh.sale/api/debug/prices"

# Test stock display
curl "https://www.tsh.sale/api/debug/stock"

# Revalidate all caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```

---

## Environment Variables

```bash
# Required for Zoho
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORGANIZATION_ID=748369814

# Required for token caching (CRITICAL)
UPSTASH_REDIS_REST_URL=https://fine-mole-41883.upstash.io
UPSTASH_REDIS_REST_TOKEN=

# Authentication
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Email
RESEND_API_KEY=
EMAIL_FROM=TSH <noreply@tsh.sale>
```

---

## Recent Issues & Fixes

### 2025-11-27: Stock Display Fix
- **Issue**: Stock showing `Stock on Hand` instead of `Available for Sale`
- **Root Cause**: Using wrong field (`warehouse_available_stock`) and wrong array (`warehouses`)
- **Fix**: Changed to `location_available_for_sale_stock` from `locations` array
- **Files Changed**: `src/lib/zoho/products.ts`

### 2025-11-26: Price Display Fix
- **Issue**: All products showing "Contact for price"
- **Root Cause**: Zoho OAuth rate limiting due to token not being cached
- **Fix**: Implemented Upstash Redis for token caching
- **Files Changed**: `src/lib/zoho/client.ts`

---

## Code Patterns

### Fetching Product Price
```typescript
import { PRICE_LIST_IDS } from '@/lib/zoho/price-lists';

// Public visitor
const price = await getPriceForItem(itemId, PRICE_LIST_IDS.CONSUMER);

// Authenticated user
const customer = await getZohoCustomerByEmail(email);
const priceListId = customer?.price_list_id || PRICE_LIST_IDS.CONSUMER;
const price = await getPriceForItem(itemId, priceListId);
```

### Extracting Stock
```typescript
export function getWholesaleAvailableStock(item: ZohoItem): number {
  const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

  const location = item.locations?.find(
    loc => loc.location_id === WHOLESALE_WAREHOUSE_ID
  );

  return location?.location_available_for_sale_stock ?? item.available_stock ?? 0;
}
```

### Adding Translation
```typescript
// Component
import { useTranslations } from 'next-intl';
const t = useTranslations('products');
return <span>{t('inStock')}</span>;

// en.json: { "products": { "inStock": "In Stock" } }
// ar.json: { "products": { "inStock": "متوفر" } }
```

---

## URLs

| Environment | URL |
|-------------|-----|
| Production | https://www.tsh.sale |
| Staging | https://staging.tsh.sale |
| Vercel | https://tsh-clients-console.vercel.app |
| Zoho Books | https://books.zoho.com/app#/748369814 |
| Zoho Inventory | https://inventory.zoho.com/app#/home/748369814 |
| Upstash Console | https://console.upstash.com |

---

## Custom Skills

Project-specific skills are available in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| **zoho-api** | Zoho API integration, debugging, token caching |
| **tsh-i18n** | Internationalization (EN/AR + RTL) |
| **tsh-pricing** | Price list logic and pricebook integration |
| **tsh-stock** | Stock/warehouse management |
| **tsh-deploy** | Vercel deployment workflow |
| **tsh-component** | UI component patterns (shadcn/ui, RTL, dark mode) |

Skills are automatically loaded when Claude detects relevant context.

---

**Last Updated:** 2025-11-27
