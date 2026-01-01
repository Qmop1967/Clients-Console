# TSH Clients Console - Claude Code Instructions

## Project Overview

**Project:** TSH Clients Console - B2B Wholesale Client Portal
**Stack:** Next.js 15, TypeScript, TailwindCSS, shadcn/ui
**Integration:** Zoho Books & Zoho Inventory APIs
**Deployment:** Vercel (preview → staging.tsh.sale, main → www.tsh.sale)

---

## Critical IDs (MEMORIZE)

| Entity | ID | Purpose |
|--------|-----|---------|
| Organization | `748369814` | Zoho org ID |
| **Main TSH Business** | `2646610000001123033` | Business location (order level) |
| **Main WareHouse** | `2646610000000077024` | Warehouse (line item stock) |
| Consumer Price List | `2646610000049149103` | Public visitors (IQD) |
| Retailor USD/IQD | `2646610000004453985` / `2646610000113426769` | Retail shops |
| Technical USD/IQD | `2646610000045742089` / `2646610000057419683` | Technicians |
| Wholesale A USD/IQD | `2646610000004152175` / `2646610000113417534` | Cash wholesale |
| Wholesale B USD/IQD | `2646610000004453961` / `2646610000113426003` | Credit wholesale |

---

## Deployment Rules

```yaml
STAGING (Automatic):
  ✅ Push to `preview` branch → staging.tsh.sale
  ✅ No approval needed

PRODUCTION (User Request Only):
  ✅ Push to `main` ONLY when user explicitly requests
  ⚠️ NEVER deploy to production automatically

FORBIDDEN:
  ❌ Push to `main` without explicit user request
  ❌ Run `vercel --prod`
```

**Staging:** `git checkout preview && git add -A && git commit -m "feat: ..." && git push origin preview`

**Production (on request):** `git checkout main && git merge preview && git push origin main && git checkout preview`

---

## Non-Negotiable Rules

### Architecture
- NEVER bypass Zoho API client for direct API calls
- ALWAYS use server-side API routes for Zoho calls
- ALWAYS include Arabic translations for new text

### Stock (CRITICAL)
```yaml
Source: Zoho Inventory API (NOT Books)
Warehouse: Main WareHouse (ID: 2646610000000077024)
Field: location_available_for_sale_stock (from locations array)
Formula: Available for Sale = Stock on Hand - Committed Stock

Functions:
  - getUnifiedStock(itemId) - Single item
  - getUnifiedStockBulk(itemIds) - List page

NEVER use: item.available_stock from Books API (total across ALL warehouses)
```

### Orders (CRITICAL)
```yaml
Order Creation - Warehouse Fulfillment:
  - Set location_id at ORDER level → Main TSH Business (tax/reporting)
  - Set location_id on EACH LINE ITEM → Main WareHouse (stock fulfillment)

NEVER use warehouse_id at order level (invalid parameter)
```

### Pricing (CRITICAL)
```yaml
NEVER display item.rate (base sell price)
ALWAYS use price from customer's assigned price list

Public visitors: Consumer price list (2646610000049149103)
Authenticated: session.user.priceListId

Shop pages MUST:
  - Call auth() to check login status
  - Use force-dynamic (prices are personalized)
  - Use getProductsWithPrices() with customer's priceListId
```

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/           # i18n routes (en/ar)
│   │   ├── (main)/         # Authenticated pages (dashboard, orders, etc.)
│   │   └── (public)/       # Public pages (shop, login)
│   └── api/
│       ├── auth/           # NextAuth endpoints
│       └── webhooks/       # Zoho webhooks
├── lib/
│   ├── auth/               # Authentication config
│   └── zoho/               # Zoho API services
│       ├── client.ts       # OAuth token management
│       ├── products.ts     # Product fetching
│       ├── orders.ts       # Order creation
│       ├── price-lists.ts  # Price list constants
│       └── stock-cache.ts  # Stock caching (Redis)
└── messages/               # Translations (en.json, ar.json)
```

---

## Key Technologies

| Technology | Purpose |
|------------|---------|
| Next.js 15 | App Router, Server Components |
| next-intl | i18n (AR/EN with RTL) |
| NextAuth.js v5 | Magic Link authentication |
| Upstash Redis | OAuth token + stock caching |
| Zoho Books | Orders, Invoices, Products (higher rate limits) |
| Zoho Inventory | Stock levels (warehouse-specific) |

---

## Environment Variables

```bash
NEXTAUTH_URL, NEXTAUTH_SECRET
ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
ZOHO_ORGANIZATION_ID=748369814
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
RESEND_API_KEY, EMAIL_FROM
```

---

## Zoho OAuth Token Caching

```yaml
Problem: Serverless functions don't share memory → every request refreshes token
Solution: Upstash Redis caching (50-min TTL)

Flow: Memory → Upstash Redis → Vercel KV → Zoho OAuth refresh

Symptom: All products show "Contact for price"
Fix: Verify UPSTASH_REDIS_REST_* env vars in Vercel
```

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Consumer prices for logged-in customers | Use `auth()` + `session.user.priceListId` |
| ISR on price pages | Use `force-dynamic` |
| Using `item.available_stock` from Books | Use `getUnifiedStock()` from Inventory |
| `warehouse_id` at order level | Use `location_id` on line items |
| Duplicate pages in route groups | Check (main) AND (public) before creating |
| Throwing on 404 webhook responses | Handle gracefully - resource may be deleted |
| Short mobile access token expiry | Keep ≥24h for browsing/checkout flow |
| Unused variables after refactoring | Run `npm run lint` before committing |
| Network errors in stock sync | Use retry with backoff (see stock-cache.ts) |
| Sequential API calls in pages | Use `Promise.all()` for parallel fetching |
| 503 errors on RSC prefetch | Configure `maxDuration` in vercel.json |

---

## Mobile API (iOS App)

```yaml
Auth Flow: OTP code via email (not magic links)
Token Expiry:
  - ACCESS_TOKEN_EXPIRY: 24 hours (was 15m - caused session issues)
  - REFRESH_TOKEN_EXPIRY: 30 days

Endpoints: /api/mobile/*
  - /auth/request-otp - Send OTP email
  - /auth/verify-otp - Verify & get tokens
  - /auth/refresh - Refresh access token
  - /products - Product listing with pagination
  - /products/[id] - Product detail
  - /categories - Category listing

CRITICAL: iOS AsyncImage requires absolute URLs for images
  - Use imageProxyUrl (not relative paths)
  - Example: https://www.tsh.sale/api/images/[itemId]
```

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/zoho-debug` | Debug Zoho API issues |
| `/zoho-price` | Price list rules and IDs |
| `/zoho-stock` | Stock calculation rules |
| `/deploy` | Production deployment workflow |
| `/i18n-add` | Add translations |
| `/diagnose` | Project health check |
| `/logs` | View Vercel logs |

---

## Quick Diagnostics

```bash
# Stock cache status
curl "https://www.tsh.sale/api/sync/stock?action=status&secret=tsh-stock-sync-2024"

# Force stock sync
curl "https://www.tsh.sale/api/sync/stock?action=sync&secret=tsh-stock-sync-2024&force=true"

# Revalidate caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"

# Check TTFB
curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s "https://www.tsh.sale/ar/shop"
```

---

## Design System

```yaml
Typography:
  Display: Cormorant Garamond (EN) / Cairo (AR)
  Body: Plus Jakarta Sans (EN) / IBM Plex Sans Arabic (AR)

Colors:
  --gold: 38 70% 50%
  --gold-subtle: 38 40% 92%

Component Variants:
  Button: gold, luxury, premium-outline, success
  Card: elevated, premium, interactive, glass
  Badge: gold, gold-subtle, pending, confirmed, shipped, delivered
```

---

## Documentation Files

| File | Purpose |
|------|---------|
| `.claude/CHANGELOG.md` | Version history |
| `.claude/PROJECT_MEMORY.md` | Critical IDs, golden rules |
| `.claude/ZOHO_INTEGRATION.md` | Zoho API reference |
| `.claude/PRICING_RULES.md` | Price list logic |
| `.claude/STOCK_RULES.md` | Stock calculation |

---

## Performance Patterns (Prevent 503 Errors)

```yaml
Problem: RSC prefetch requests return 503 Service Unavailable
Cause: Next.js prefetches multiple pages concurrently, each spawning
       a serverless function with sequential API calls → timeout

Solutions Applied:
  1. vercel.json maxDuration: Pages=30s, API routes=60s
  2. Promise.all() for parallel API calls in pages
  3. Redis caching for stock data (avoids Zoho API on every request)

Page Data Fetching Pattern:
  ✅ GOOD - Parallel fetching:
  const [product, stock, prices] = await Promise.all([
    getProduct(id),
    getUnifiedStock(id),
    getCustomerPriceList(priceListId, [id]),
  ]);

  ❌ BAD - Sequential fetching (causes timeouts):
  const product = await getProduct(id);
  const stock = await getUnifiedStock(id);
  const prices = await getCustomerPriceList(priceListId, [id]);

Function Duration Config (vercel.json):
  - Pages (app/**/page.tsx): maxDuration 30s
  - API routes (app/api/**/*.ts): maxDuration 60s

Monitoring:
  # Check TTFB (should be < 1s for cached pages)
  curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s "URL"

  # Check for 503 in browser DevTools Network tab
  # Filter by RSC requests (_rsc query param)
```

---

## Error Handling Patterns

```yaml
Webhooks (api/webhooks/zoho):
  404 Response: Return success with notFound flag (resource deleted)
  Rate Limit: Log warning, don't throw CRITICAL errors
  Network Error: Retry with backoff (3 attempts)

Stock Sync (lib/zoho/stock-cache.ts):
  404 Item: Remove from cache (item deleted) - don't error
  Rate Limit: Wait 3s + retry (3 attempts max)
  Network Error: Retry with exponential backoff
  Redis Save: Retry 3x with increasing delay

API Routes:
  External API 404: Return graceful response, not 500
  Use console.warn for transient issues (not console.error)
  Use console.error only for actual failures needing attention

Logging Levels:
  ✅ success - console.log with ✅ emoji
  ⚠️ warning - console.warn (transient, expected errors)
  ❌ error - console.error (unexpected, needs attention)
  ℹ️ info - console.log (informational, not success/failure)
```

---

## Pre-Commit Checklist

Before pushing to preview or main:

```bash
# 1. Run linter (catches unused variables)
npm run lint

# 2. Run type check (catches type errors)
npm run typecheck

# 3. Check for duplicate pages
ls src/app/[locale]/(main)/ src/app/[locale]/(public)/ | sort | uniq -d

# 4. Verify no console.error for expected conditions
grep -r "console.error" src/ | grep -v "node_modules"
```

---

## URLs

- **Staging:** https://staging.tsh.sale
- **Production:** https://www.tsh.sale
- **Vercel:** https://vercel.com/tsh-03790822/tsh-clients-console
- **Zoho Books:** https://books.zoho.com/app#/748369814

---

**Version:** 2.2.0 | **Last Updated:** 2026-01-01

TSH = Tech Spider Hand
