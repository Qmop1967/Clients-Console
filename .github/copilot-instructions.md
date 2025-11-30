# TSH Clients Console - AI Coding Instructions

## Project Overview
B2B wholesale client portal (Next.js 15 + TypeScript) integrated with Zoho Books/Inventory APIs. Bilingual (EN/AR with RTL).

## Architecture

### Data Flow
```
Client → Server Components → src/lib/zoho/*.ts → Zoho OAuth (cached in Upstash Redis) → Zoho APIs
```

- **All Zoho API calls are server-side only** via `src/lib/zoho/client.ts`
- OAuth tokens cached in Upstash Redis (50min TTL) to avoid rate limits
- Use `zohoFetch()` and `rateLimitedFetch()` wrappers—never call Zoho directly

### Route Structure
```
src/app/[locale]/
├── (auth)/login/      # Public - magic link auth
├── (public)/shop/     # Public - product catalog  
├── (main)/            # Protected - dashboard, orders, invoices, etc.
```

- Middleware (`src/middleware.ts`) handles auth checks and i18n routing
- Public paths: `/login`, `/shop`, `/cart`, `/register`, `/api`

## Critical Rules

### Stock Display
```typescript
// ONLY use WholeSale WareHouse stock (ID: 2646610000000077024)
// Field: location_available_for_sale_stock (NOT stock_on_hand)
// List API uses warehouse_id filter; detail API has locations array
import { getProduct, getAllProductsComplete } from '@/lib/zoho/products';
```

### Pricing
```typescript
// NEVER display item.rate - ALWAYS use price list
import { getPriceListWithItems, getItemPriceFromList, PRICE_LIST_IDS } from '@/lib/zoho/price-lists';

// Public visitors: PRICE_LIST_IDS.CONSUMER (IQD)
// Authenticated: customer.price_list_id from session
// Items not in pricebook: show "Contact for price", NOT 0
```

### Internationalization
```typescript
// Add BOTH translations to src/messages/en.json and ar.json
import { useTranslations } from 'next-intl';
const t = useTranslations('namespace');

// Test RTL layout for Arabic
// locales: ['en', 'ar'], defaultLocale: 'en'
```

## Key Files

| Purpose | Location |
|---------|----------|
| Zoho OAuth + fetch wrapper | `src/lib/zoho/client.ts` |
| Products/stock logic | `src/lib/zoho/products.ts` |
| Price list logic | `src/lib/zoho/price-lists.ts` |
| Auth config | `src/lib/auth/auth.ts` |
| i18n config | `src/i18n/config.ts` |
| Type definitions | `src/types/index.ts` |
| UI components | `src/components/ui/` (shadcn/ui) |

## Development

```bash
npm run dev          # Development server
npm run build        # Build (validates types)
npm run lint         # ESLint
vercel --prod --yes  # Deploy to production
```

### Cache Revalidation
```bash
# Manual revalidation endpoint
/api/revalidate?tag=products&secret=tsh-revalidate-2024
# Tags: products, categories, price-lists, warehouses, all
```

### Debugging
- `/api/debug/token` - Test Zoho OAuth
- `/api/debug/prices` - Test price fetching
- `/api/debug/stock` - Test stock values

## Conventions

- **Server Components by default** - use `'use client'` only when needed
- **Caching**: Use `unstable_cache` with appropriate tags for revalidation
- **Error handling**: Always handle loading/error states in UI
- **Validation**: Use Zod for input validation
- **Styling**: TailwindCSS + shadcn/ui components (`src/components/ui/`)

## Environment Variables (Required)
```
ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORGANIZATION_ID
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
NEXTAUTH_URL, NEXTAUTH_SECRET
RESEND_API_KEY, EMAIL_FROM
```
