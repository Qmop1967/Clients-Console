# TSH Clients Console - Claude Code Instructions

## Project Overview

**Project:** TSH Clients Console - B2B Wholesale Client Portal
**Stack:** Next.js 15, TypeScript, TailwindCSS, shadcn/ui
**Purpose:** Self-service portal for TSH wholesale clients to browse products, place orders, view invoices, and manage their accounts
**Integration:** Zoho Books & Zoho Inventory APIs
**Deployment:** Vercel (Staging → Production workflow)

---

## Current Implementation Status

### Completed Features
- **Shop Page**: Public product catalog with real Zoho Books data (1300+ products)
- **Dashboard**: Real-time customer balance, order stats, recent orders/invoices from Zoho Books
- **Orders Page**: Full order history with pagination from Zoho Books
- **Invoices Page**: Invoice listing with status and pagination from Zoho Books
- **Payments Page**: Payment history with pagination from Zoho Books
- **Credit Notes Page**: Credit notes with available balance from Zoho Books
- **Authentication**: Magic link login via NextAuth.js v5
- **Internationalization**: English/Arabic with RTL support
- **Theme**: Light/Dark mode support

### Data Integration
All pages now fetch data primarily from **Zoho Books API** (higher rate limits):
- Products from Zoho Books (`/items` endpoint) - **MIGRATED from Inventory**
- Categories from Zoho Books (`/categories` endpoint) - **MIGRATED from Inventory**
- Price Lists from Zoho Books (`/pricebooks` endpoint) - **MIGRATED from Inventory**
- Item Prices from Zoho Books (`/items/pricebookrate` endpoint)
- Orders from Zoho Books (`/salesorders` endpoint)
- Invoices from Zoho Books (`/invoices` endpoint)
- Payments from Zoho Books (`/customerpayments` endpoint)
- Credit Notes from Zoho Books (`/creditnotes` endpoint)
- Customer Data from Zoho Books (`/contacts` endpoint)
- Images from Zoho Books (`/items/{id}/image` endpoint) - **MIGRATED from Inventory**

**Note:** Zoho Books has higher API rate limits than Zoho Inventory:
- Books: ~100 requests/minute per organization
- Inventory: ~3,750 requests/day per organization (can be exhausted quickly)

### Caching Strategy
- Products: 1 hour cache with `unstable_cache`
- Orders/Invoices/Payments: 2 minutes cache
- Customer data: 5 minutes cache
- Price lists: 1 hour cache
- Webhook-based revalidation available

---

## Deployment Rules

### Branch Strategy (Two-Branch Workflow)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  preview branch ──→ GitHub Actions ──→ staging.tsh.sale        │
│       │                                    │                    │
│       │              User verifies         │                    │
│       ↓                   ↓                ↓                    │
│  main branch ──→ GitHub Actions ──→ www.tsh.sale (PRODUCTION)  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| Branch | Purpose | Auto-Deploy | Target |
|--------|---------|-------------|--------|
| `preview` | Development & staging | Yes (GitHub Actions) | staging.tsh.sale |
| `main` | Production-ready code | Yes (GitHub Actions) | www.tsh.sale |

### Claude Code Deployment Rules

```yaml
STAGING DEPLOYMENT (Automatic):
  ✅ Push to `preview` branch anytime
  ✅ GitHub Actions deploys to staging.tsh.sale
  ✅ No user approval needed

PRODUCTION DEPLOYMENT (On User Request Only):
  ✅ Push to `main` branch ONLY when user explicitly requests
  ✅ GitHub Actions deploys to www.tsh.sale
  ⚠️ NEVER deploy to production automatically
  ⚠️ NEVER deploy to production without explicit user request

FORBIDDEN:
  ❌ Push to `main` without user explicitly saying "deploy to production"
  ❌ Run `vercel --prod` or any direct Vercel CLI production commands
  ❌ Deploy to production automatically after staging
```

### GitHub Actions Workflows

```yaml
STAGING WORKFLOW (.github/workflows/preview.yml):
  Trigger: Push to `preview` branch
  Target: staging.tsh.sale
  Auto-deploy: YES

PRODUCTION WORKFLOW (.github/workflows/production.yml):
  Trigger: Push to `main` branch
  Target: www.tsh.sale
  Auto-deploy: YES (but Claude only pushes when user requests)

GitHub Secrets (configured):
  - VERCEL_TOKEN: Vercel API token
  - VERCEL_ORG_ID: team_rgs5sBv5aI1FH5pFAAfflSTd
  - VERCEL_PROJECT_ID: prj_WayTPxtTtlwrZCZZEy8xD4kyAxds
```

### Deployment Steps for Claude Code

**Staging Deployment:**
```bash
# 1. Ensure you're on preview branch
git checkout preview

# 2. Stage all changes
git add -A

# 3. Commit with descriptive message
git commit -m "feat: description of changes"

# 4. Push to preview branch (triggers staging deployment)
git push origin preview

# 5. Tell user: "Deployed to staging.tsh.sale"
```

**Production Deployment (ONLY when user explicitly requests):**
```bash
# 1. Ensure preview is up to date
git checkout preview
git pull origin preview

# 2. Switch to main and merge preview
git checkout main
git pull origin main
git merge preview

# 3. Push to main (triggers production deployment)
git push origin main

# 4. Tell user: "Deployed to www.tsh.sale (production)"

# 5. Switch back to preview for future work
git checkout preview
```

### URLs

| Environment | URL | Deployed By | Trigger |
|-------------|-----|-------------|---------|
| Staging | staging.tsh.sale | GitHub Actions | Push to `preview` branch |
| Production | www.tsh.sale | GitHub Actions | Push to `main` branch (user request only) |

### Vercel Configuration (User Must Configure)

```yaml
IMPORTANT: User must configure these settings in Vercel Dashboard:

1. Go to: https://vercel.com/tsh-03790822/tsh-clients-console/settings/git
2. Production Branch: Set to `main`
3. Auto-Deploy: DISABLE for production branch
4. Preview Deployments: Keep enabled (handled by GitHub Actions)

This ensures:
  - Push to `main` does NOT trigger production deployment
  - Production deployment is MANUAL ONLY via Vercel Dashboard
  - Preview deployments work via GitHub Actions
```

---

## Project Structure

```
tsh-clients-console/
├── src/
│   ├── app/
│   │   ├── [locale]/          # i18n routes (en/ar)
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── products/      # Product catalog
│   │   │   ├── orders/        # Order history
│   │   │   ├── invoices/      # Invoice management
│   │   │   ├── payments/      # Payment history
│   │   │   ├── credit-notes/  # Credit notes
│   │   │   ├── account-statement/ # Statement
│   │   │   ├── support/       # Support tickets
│   │   │   ├── profile/       # User profile
│   │   │   └── login/         # Authentication
│   │   └── api/
│   │       ├── auth/          # NextAuth endpoints
│   │       └── webhooks/      # Zoho webhooks
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── layout/            # Layout components
│   ├── lib/
│   │   ├── auth/              # Authentication config
│   │   └── zoho/              # Zoho API services
│   ├── i18n/                  # Internationalization
│   └── messages/              # Translation files (en.json, ar.json)
├── public/                    # Static assets
└── .claude/                   # Claude Code instructions
```

---

## Key Technologies

| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework with App Router |
| TypeScript | Type safety |
| TailwindCSS | Styling |
| shadcn/ui | UI components |
| next-intl | Internationalization (AR/EN) |
| next-themes | Dark/Light mode |
| NextAuth.js | Magic Link authentication |
| Resend | Email delivery |
| Zoho Books API | Orders, Invoices, Payments |
| Zoho Inventory API | Products, Stock |

---

## Environment Variables

```bash
# Required in .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<secret>

# Zoho API
ZOHO_CLIENT_ID=<client_id>
ZOHO_CLIENT_SECRET=<client_secret>
ZOHO_REFRESH_TOKEN=<refresh_token>
ZOHO_ORGANIZATION_ID=748369814

# Upstash Redis (CRITICAL - for Zoho OAuth token caching)
UPSTASH_REDIS_REST_URL=https://fine-mole-41883.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>

# Email (Resend)
RESEND_API_KEY=<api_key>
EMAIL_FROM=TSH <noreply@tsh.sale>
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build
npm run build

# Lint
npm run lint

# Switch to preview branch (Claude Code MUST work on preview branch)
git checkout preview

# Push to preview branch (triggers staging deployment)
git add -A && git commit -m "feat: description" && git push origin preview

# FORBIDDEN for Claude Code:
# - git push origin main (production-ready code only, user pushes)
# - vercel --prod (production deployment forbidden)
# - Any direct production deployment

# Production deployment
# User manually deploys via Vercel Dashboard after staging verification
```

---

## Non-Negotiable Rules

### Architecture
- NEVER bypass Zoho API client for direct API calls
- NEVER store sensitive data in localStorage
- ALWAYS use server-side API routes for Zoho calls
- ALWAYS include Arabic translations for new text

### Code Quality
- ALWAYS use TypeScript strict mode
- ALWAYS validate inputs with Zod
- NEVER commit .env files
- ALWAYS handle loading and error states

### Deployment
- ALWAYS work on and push to `preview` branch
- NEVER push to `main` branch (reserved for production-ready code)
- NEVER deploy directly to production - user does this manually via Vercel Dashboard
- NEVER run `vercel --prod` or any production deployment command
- Verify on staging.tsh.sale before user deploys to production

### Internationalization
- ALWAYS add both English and Arabic translations
- ALWAYS test RTL layout for Arabic
- NEVER hardcode text strings in components

### Stock & Pricing Rules

#### Stock Source (CRITICAL)
```yaml
Stock Display Rules:
  Source: Zoho Inventory API
  Stock Type: Accounting Stock (NOT Physical Stock)
  Warehouse: Main WareHouse
  Warehouse ID: 2646610000000077024
  Field: location_available_for_sale_stock (from locations array)

  Formula:
    Available for Sale = Stock on Hand - Committed Stock

  NEVER use:
    - Physical Stock
    - Stock from other warehouses (TSH WholeSale Sales, Retail WareHouse, TSH Retail Store)
    - Stock on Hand alone (always use Available for Sale)
    - The `warehouses` array (Zoho uses `locations` array instead)

Technical Implementation:
  # Zoho API returns `locations` array (NOT `warehouses`) for item stock breakdown
  # Single item endpoint: GET /items/{item_id} returns locations array
  # List endpoint: GET /items does NOT return locations data

  Code Location: src/lib/zoho/products.ts
  Key Function: getWholesaleAvailableStock(item)

  The function extracts stock from the locations array:
    - Finds location with name "Main WareHouse"
    - Returns location_available_for_sale_stock value
    - Falls back to item-level available_stock if no locations data

  Important:
    - Detail page (getProduct): Fetches single item with locations array → accurate stock
    - List page (getAllProductsComplete): Uses warehouse_id filter, relies on item-level stock
    - The warehouse_id parameter filters items but doesn't change stock values
```

#### Stock Cache Architecture (CRITICAL)
```yaml
Stock Data Flow:
  1. Product metadata cached 24h (Zoho Books API) - NO stock from Books used
  2. Warehouse-specific stock cached in Redis (30 min TTL)
  3. UNIFIED stock functions ensure consistency between pages
  4. Shop page filters: available_stock > 0

CRITICAL: Single Source of Truth
  Both shop list and product detail pages use UNIFIED stock functions:
  - getUnifiedStock(itemId) - For single item (detail page)
  - getUnifiedStockBulk(itemIds) - For list (shop page)

  These functions ONLY use Redis cache as the stock source.
  They do NOT fall back to Zoho Books item-level stock.
  This prevents stock discrepancy between list and detail views.

  Why no Books fallback:
  - Books API `available_stock` = Total across ALL warehouses
  - Inventory API `location_available_for_sale_stock` = Only Main WareHouse
  - These values are DIFFERENT, causing user-visible inconsistency

Stock Resolution Priority:
  1. Redis cache (warehouse-specific, most accurate)
  2. Fetch from Inventory API + cache result (on-demand, detail page only)
  3. Return 0 if unavailable (NOT Books fallback)

Quick Diagnostics:
  Check cache: curl "https://www.tsh.sale/api/sync/stock?action=status"
  - If itemCount < 100: Cache needs sync
  - Force sync: curl "https://www.tsh.sale/api/sync/stock?action=sync&secret=<SECRET>&force=true"

Code Locations:
  - getUnifiedStock(): src/lib/zoho/stock-cache.ts:594-646
  - getUnifiedStockBulk(): src/lib/zoho/stock-cache.ts:683-728
  - getAllProductsComplete(): src/lib/zoho/products.ts:585-633
  - Product detail: src/app/[locale]/(public)/shop/[id]/page.tsx:61-112
```

#### Stock Consistency Rules (CRITICAL)
```yaml
PROBLEM SOLVED:
  Stock displayed on shop list was DIFFERENT from product detail page.
  Root cause: Different fallback sources when Redis cache missed.
  - List: Fell back to Books API (total across all warehouses)
  - Detail: Fell back to Inventory API (warehouse-specific)

SOLUTION IMPLEMENTED:
  Unified stock functions that BOTH pages use:
  - getUnifiedStock(itemId) - Returns { stock, source: 'cache'|'api'|'unavailable' }
  - getUnifiedStockBulk(itemIds) - Returns Map<itemId, stock>

  On-demand caching:
  - When detail page fetches fresh stock from Inventory API
  - It automatically saves to Redis cache
  - Next list page load sees the same value

NEVER DO:
  - Use `item.available_stock` from Books API as stock source
  - Fall back to Books data when Redis cache misses
  - Use getCachedStock()/getCachedStockBulk() directly (deprecated)
  - Use different functions for list vs detail stock

ALWAYS DO:
  - Use getUnifiedStock() for single item stock
  - Use getUnifiedStockBulk() for list stock
  - Run stock sync before deploying stock-related changes
  - Check that Redis cache has 400+ items after sync

Verification Checklist (After Stock Changes):
  1. Pick 3 random products from shop list
  2. Note stock value shown on list
  3. Click into detail page
  4. Verify stock matches EXACTLY
  5. If mismatch: check Redis cache completeness

Deprecated Functions (DO NOT USE):
  - getCachedStock() → Use getUnifiedStock() instead
  - getCachedStockBulk() → Use getUnifiedStockBulk() instead
```

#### Order Creation & Warehouse Fulfillment (CRITICAL)
```yaml
PROBLEM: Orders were taking stock from business location instead of warehouse.
  - Main TSH Business showed -1,500 stock (wrong!)
  - Main WareHouse showed 1,500 stock unchanged (should have been deducted)

ROOT CAUSE:
  The Zoho Inventory API uses `location_id` on LINE ITEMS to specify
  which warehouse to fulfill stock from. NOT `warehouse_id` at order level.
  - `warehouse_id` is NOT a valid parameter for sales orders
  - `location_id` must be set on EACH LINE ITEM

ZOHO LOCATION STRUCTURE:
  Main TSH Business (Business Location)
    └── Main WareHouse (Warehouse - child location)

Location IDs:
  | Location | Type | ID | Purpose |
  |----------|------|-----|---------|
  | Main TSH Business | Business Location | 2646610000001123033 | Tax/reporting (order level) |
  | Main WareHouse | Warehouse | 2646610000000077024 | Stock fulfillment (line item level) |

CORRECT API REQUEST STRUCTURE:
  {
    "customer_id": "...",
    "location_id": "2646610000001123033",    // Business location (order level)
    "line_items": [
      {
        "item_id": "...",
        "quantity": 1,
        "rate": 2250,
        "location_id": "2646610000000077024"  // Warehouse (line item level) ← CRITICAL!
      }
    ]
  }

NEVER DO:
  - Use `warehouse_id` at order level (invalid parameter, causes error)
  - Omit `location_id` from line items (defaults to business location)
  - Use `location_id` only at order level (stock taken from business location)

ALWAYS DO:
  - Set `location_id` at ORDER level → Main TSH Business (for tax/reporting)
  - Set `location_id` on EACH LINE ITEM → Main WareHouse (for stock fulfillment)

Code Location: src/lib/zoho/orders.ts
Key Function: createSalesOrder()
Constants:
  - MAIN_TSH_BUSINESS_ID = '2646610000001123033'
  - MAIN_WAREHOUSE_ID = '2646610000000077024'

VERIFICATION:
  After order creation, check in Zoho:
  1. Order shows "Location: Main TSH Business" at top
  2. Line item shows "LOCATION: Main WareHouse" in items table
  3. Stock deducted from Main WareHouse in Stock Locations panel

API Documentation:
  - https://www.zoho.com/inventory/api/v1/salesorders/
  - Line items support `location_id` field for warehouse-specific fulfillment
```

#### Pricing Rules (CRITICAL)
```yaml
IMPORTANT: NEVER display the base "rate" field from items API.
           ALWAYS use prices from the appropriate price list.

Public Visitors (Not Logged In):
  Price List: Consumer (IQD)
  Pricebook ID: 2646610000049149103
  Currency: IQD
  Source: Zoho Inventory Pricebook API - fetch full pricebook with items
  Fallback: If item not in pricebook, show "Contact for price" (NOT 0 IQD)

Authenticated Users:
  Price List: Customer's assigned price_list_id from Zoho contact
  Currency: From customer's assigned price list
  Fallback: Consumer price list if no specific list assigned
  Source: ZohoCustomer.price_list_id field

Implementation:
  1. Fetch full pricebook with /pricebooks/{id} endpoint (includes pricebook_items)
  2. Map item_id to get the specific price from pricebook_items array
  3. Use pricebook's currency_code for display
  4. NEVER fall back to item.rate (sell price)
  5. For items NOT in pricebook: inPriceList=false → show "Contact for price"
```

#### Customer-Specific Pricing Architecture (CRITICAL)
```yaml
GOLDEN RULE: Logged-in customers MUST see their assigned price list on ALL pages.
             NEVER show Consumer prices to authenticated wholesale/retail customers.

WHY THIS MATTERS:
  - B2B customers have negotiated prices (Wholesale, Retail, Technical)
  - They expect to see THEIR prices, not public Consumer prices
  - Showing wrong prices breaks trust and causes confusion

IMPLEMENTATION REQUIREMENTS:
  Shop Page (/shop):
    - MUST call auth() to check if user is logged in
    - MUST use session.user.priceListId for authenticated users
    - Falls back to PRICE_LIST_IDS.CONSUMER only for public visitors
    - Page uses `force-dynamic` to enable personalization

  Product Detail Page (/shop/[id]):
    - MUST call auth() to check if user is logged in
    - MUST use session.user.priceListId for pricing
    - Falls back to fetching from Zoho if priceListId not in session

  Session Data Flow:
    1. User logs in via magic link
    2. signIn callback fetches customer from Zoho (getZohoCustomerFresh)
    3. Extracts pricebook_id (or price_list_id) from customer record
    4. Stores in session: session.user.priceListId
    5. Session callback refreshes Zoho data every 2 minutes (cache TTL)

  Code Locations:
    - Shop page: src/app/[locale]/(public)/shop/page.tsx
    - Product detail: src/app/[locale]/(public)/shop/[id]/page.tsx
    - Auth config: src/lib/auth/auth.config.ts
    - Auth handlers: src/lib/auth/auth.ts

NEVER DO:
  - Cache shop page with ISR when it shows prices (prices are personalized)
  - Use `revalidate = N` on pages that show customer-specific prices
  - Show Consumer prices to logged-in customers "for performance"
  - Skip auth() check on pages that display prices

ALWAYS DO:
  - Use `force-dynamic` on pages with personalized pricing
  - Check session.user.priceListId before fetching prices
  - Log which price list is being used in development mode
  - Test with different customer accounts (Wholesale, Retail, etc.)

DEBUGGING:
  If customer sees wrong prices:
    1. Check their Zoho contact: pricebook_id field
    2. Check session: session.user.priceListId
    3. Check logs: "[Shop] Using price list: XXX"
    4. Verify session refresh is working (2-min cache)

  Quick test:
    curl "https://www.tsh.sale/api/debug/session" (while logged in)
```

### TSH Price Lists Reference (Updated: 2025-12-09)

| ID | Name | Currency | Type | Description |
|----|------|----------|------|-------------|
| `2646610000049149103` | **Consumer** | IQD | Individual Items | المستهلك - Public visitors and individual consumers |
| `2646610000004453985` | **Retailor USD** | USD | Individual Items | التجزئة (دولار) - Retail shops and small quantity dealers |
| `2646610000113426769` | **Retailor IQD** | IQD | Individual Items | التجزئة (دينار) - Retail shops with IQD pricing |
| `2646610000057419683` | **Technical IQD** | IQD | Individual Items | الفني (دينار) - Technicians with IQD pricing |
| `2646610000045742089` | **Technical USD** | USD | Individual Items | الفني (دولار) - Technicians with USD pricing |
| `2646610000004152175` | **Wholesale A USD** | USD | Individual Items | جملة أ (دولار) - Cash wholesale, large quantities (نقدي) |
| `2646610000113417534` | **Wholesale A IQD** | IQD | Individual Items | جملة أ (دينار) - Cash wholesale with IQD pricing |
| `2646610000004453961` | **Wholesale B USD** | USD | Individual Items | جملة ب (دولار) - Credit wholesale, large quantities (اجل) |
| `2646610000113426003` | **Wholesale B IQD** | IQD | Individual Items | جملة ب (دينار) - Credit wholesale with IQD pricing |

### Price List Assignment Logic

```typescript
// src/lib/zoho/price-lists.ts exports:
import { PRICE_LIST_IDS, PRICE_LIST_INFO } from '@/lib/zoho/price-lists';

// Get price list for any scenario:
// 1. Public visitor → PRICE_LIST_IDS.CONSUMER
// 2. Authenticated → customer.price_list_id || PRICE_LIST_IDS.CONSUMER
// 3. Retail shop (USD) → PRICE_LIST_IDS.RETAILOR_USD
// 4. Retail shop (IQD) → PRICE_LIST_IDS.RETAILOR_IQD
// 5. Technician (IQD) → PRICE_LIST_IDS.TECHNICAL_IQD
// 6. Technician (USD) → PRICE_LIST_IDS.TECHNICAL_USD
// 7. Wholesale cash (USD) → PRICE_LIST_IDS.WHOLESALE_A_USD
// 8. Wholesale cash (IQD) → PRICE_LIST_IDS.WHOLESALE_A_IQD
// 9. Wholesale credit (USD) → PRICE_LIST_IDS.WHOLESALE_B_USD
// 10. Wholesale credit (IQD) → PRICE_LIST_IDS.WHOLESALE_B_IQD
```

---

## API Integration

### Zoho Books API
- Base URL: `https://www.zohoapis.com/books/v3`
- Organization ID: `748369814`
- Authentication: OAuth 2.0 with refresh token

### Zoho Inventory API
- Base URL: `https://www.zohoapis.com/inventory/v1`
- Organization ID: `748369814`
- Authentication: OAuth 2.0 with refresh token

### Cache Strategy
- Products: 1 hour cache, webhook revalidation
- Orders/Invoices: 5 minute cache, webhook revalidation
- Customer data: 15 minute cache

---

## CRITICAL: Zoho OAuth Token Caching (Upstash Redis)

### Why This Matters

```yaml
PROBLEM: Vercel Serverless Function Isolation
  - Each serverless function invocation is ISOLATED
  - In-memory variables do NOT persist between requests
  - Without external caching, EVERY request triggers a Zoho OAuth token refresh
  - Zoho rate-limits OAuth token refreshes (~100/minute)
  - Result: "Contact for price" shown for ALL products when rate-limited

SOLUTION: Upstash Redis for Persistent Token Caching
  - Tokens cached in Upstash Redis (50-minute TTL)
  - Multi-tier fallback: Memory → Upstash → Vercel KV → Zoho refresh
  - Rate limit guard: 10-second minimum between refresh attempts
  - Automatic retry on rate limit with 10-second backoff
```

### Token Caching Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Request for Zoho Data                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Check In-Memory Cache (fastest, same invocation only)       │
│     - Works within single serverless invocation                 │
│     - Lost after function terminates                            │
└─────────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Check Upstash Redis (PRIMARY external cache)                │
│     - REST API: https://fine-mole-41883.upstash.io              │
│     - TTL: 50 minutes (tokens expire in 1 hour)                 │
│     - Persists across ALL serverless invocations                │
└─────────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Check Vercel KV (BACKUP external cache, if configured)      │
│     - Uses KV_REST_API_URL and KV_REST_API_TOKEN                │
│     - Same TTL and behavior as Upstash                          │
└─────────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Rate Limit Guard                                            │
│     - Prevents token refresh spam (10-second minimum interval)  │
│     - If last refresh was <10s ago, wait before proceeding      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Refresh Token from Zoho OAuth                               │
│     - POST https://accounts.zoho.com/oauth/v2/token             │
│     - On success: Save to ALL configured caches                 │
│     - On rate limit: Wait 10s and retry once                    │
└─────────────────────────────────────────────────────────────────┘
```

### Upstash Redis Configuration

```yaml
Console: https://console.upstash.com
Database Name: clientsconsole
Region: Global (closest to user)
Endpoint: https://fine-mole-41883.upstash.io

Environment Variables (MUST be set in Vercel):
  UPSTASH_REDIS_REST_URL: https://fine-mole-41883.upstash.io
  UPSTASH_REDIS_REST_TOKEN: <token from Upstash console>

Token Storage:
  Key: zoho:access_token
  Value: JSON { access_token: string, expires_at: number }
  TTL: 3000 seconds (50 minutes)
```

### Implementation Details

The token caching logic is in `src/lib/zoho/client.ts`:

```typescript
// Key functions:
getAccessToken()        // Main entry point - uses multi-tier caching
getTokenFromUpstash()   // Check Upstash Redis cache
saveTokenToUpstash()    // Save token to Upstash (TTL: 50 min)
getTokenFromVercelKv()  // Backup: Check Vercel KV
saveTokenToVercelKv()   // Backup: Save to Vercel KV

// Important: NO SDK required - uses direct REST API calls
// This avoids edge runtime compatibility issues
```

### Troubleshooting

```yaml
Symptom: All products show "Contact for price" (اتصل للسعر)
Cause: Zoho OAuth rate limiting due to missing token cache

Check:
  1. Verify Upstash environment variables are set in Vercel
  2. Check Upstash console for the cached token
  3. Check Vercel function logs for "Rate limited by Zoho" messages

Fix:
  1. Go to Vercel Dashboard → Project Settings → Environment Variables
  2. Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set
  3. Redeploy the application

Debug Endpoints (remove after debugging):
  - /api/debug/token - Tests Zoho token refresh directly
  - /api/debug/prices - Tests price fetching with token caching
```

### If Upstash Credentials Are Lost

1. Go to https://console.upstash.com
2. Find the "clientsconsole" database
3. Click "REST API" tab
4. Copy the URL and Token
5. Update Vercel environment variables:
   ```bash
   vercel env rm UPSTASH_REDIS_REST_URL production preview
   vercel env rm UPSTASH_REDIS_REST_TOKEN production preview
   printf "https://fine-mole-41883.upstash.io" | vercel env add UPSTASH_REDIS_REST_URL production preview
   printf "<new-token>" | vercel env add UPSTASH_REDIS_REST_TOKEN production preview
   ```
6. Redeploy: `vercel --prod --yes`

---

## MCP Browser Tools - Best Practices

### Avoiding Large MCP Responses (Context Overflow)

When using Playwright/Chrome DevTools MCP tools, large responses can fill up context quickly. Follow these rules:

```yaml
CRITICAL: Product listing pages can return 25k+ tokens in snapshots!

DO:
  - Use `browser_take_screenshot` for visual verification on listing pages
  - Navigate to specific product pages (/shop/{id}) for detailed testing
  - Close browser immediately after verification with `browser_close`
  - Use URL parameters to filter/limit results (?search=specific-item)

DON'T:
  - Use `browser_snapshot` on pages with many elements (shop listings, tables)
  - Leave browser open between unrelated tasks
  - Take full-page snapshots when a screenshot suffices

Example - Testing a specific product:
  ✅ Navigate to: /en/shop/2646610000109854052 (specific product)
  ❌ Navigate to: /en/shop (listing with 1000+ products)

Example - Visual verification:
  ✅ browser_take_screenshot (small response)
  ❌ browser_snapshot on listing page (25k+ tokens)
```

### Cache Revalidation Endpoint

```yaml
Endpoint: /api/revalidate
Method: GET
Auth: ?secret=tsh-revalidate-2024

Usage:
  Revalidate products: /api/revalidate?tag=products&secret=tsh-revalidate-2024
  Revalidate all:      /api/revalidate?tag=all&secret=tsh-revalidate-2024

Available tags: products, categories, price-lists, warehouses, all

When to use:
  - After deploying code changes that affect cached data
  - When cached data appears stale
  - After fixing data calculation bugs (like stock display)
```

---

## Webhook Events

The app listens for Zoho webhooks at `/api/webhooks/zoho`:
- `item.created/updated/deleted` → Revalidate products
- `salesorder.created/updated` → Revalidate orders
- `invoice.created/updated/paid` → Revalidate invoices
- `payment.created/updated` → Revalidate payments
- `creditnote.created/updated` → Revalidate credit notes

---

## Domain Configuration

| Domain | Purpose | Status |
|--------|---------|--------|
| staging.tsh.sale | **Staging (DEFAULT)** | Configured |
| www.tsh.sale | Production | Configured |
| tsh-clients-console.vercel.app | Vercel default | Active |

DNS Configuration (Namecheap):
- `staging` CNAME → `cname.vercel-dns.com` (for staging.tsh.sale)
- `www` CNAME → `cname.vercel-dns.com`
- `_vercel` TXT → Verification record

---

## Design System (v1.6.0)

### Typography
```yaml
Display (Headings):
  English: Cormorant Garamond (serif) - elegant, luxury feel
  Arabic: Cairo - refined Arabic display font
  Usage: .font-display, h1-h3, product titles, prices

Body (Content):
  English: Plus Jakarta Sans (sans-serif) - modern, readable
  Arabic: IBM Plex Sans Arabic - clean Arabic body text
  Usage: .font-body (default), paragraphs, UI elements
```

### Color System
```css
/* Gold Accent System */
--gold: 38 70% 50%        /* Primary gold */
--gold-subtle: 38 40% 92% /* Subtle gold tint */
--accent: 38 60% 45%      /* Muted gold */

/* Usage Classes */
.text-gold      /* Gold text */
.bg-gold        /* Gold background */
.price-tag      /* For prices - serif + semibold */
.price-display  /* For large price displays - serif + bold */
```

### Component Variants

| Component | Variants |
|-----------|----------|
| Button | `gold`, `luxury`, `premium-outline`, `success`, sizes: `xl`, `icon-sm`, `icon-lg` |
| Card | `elevated`, `premium`, `interactive`, `glass`, `outline`, `ghost` |
| Badge | `gold`, `gold-subtle`, `glass`, `pending`, `confirmed`, `shipped`, `delivered` |
| Input | `default`, `premium`, `ghost`, `error`, sizes: `sm`, `lg` |

### Shadow System
```css
--shadow-gold: 0 4px 14px hsl(38 70% 50% / 0.15)
--shadow-glow: 0 0 20px hsl(38 70% 50% / 0.3)
```

---

## Session Protocol

### At the START of Every Session
```bash
# 1. Read documentation
Read CLAUDE.md (this file)
Read .claude/PROJECT_MEMORY.md for critical IDs

# 2. Verify git state
git branch --show-current  # Must be on 'preview'
git status                  # Check for uncommitted changes

# 3. If not on preview, switch
git checkout preview
git pull origin preview

# 4. Review recent changes
git log --oneline -5
```

### At the END of Changes
```bash
# 1. Verify branch
git branch --show-current  # Must be 'preview'

# 2. Run checks before commit
npm run typecheck
npm run lint

# 3. Commit and push
git add -A
git commit -m "feat: description"
git push origin preview

# 4. Inform user
"Deployed to staging.tsh.sale - please verify before production deployment"
```

---

## Code Quality Rules

### Console Logging
```yaml
RULE: NEVER use emoji-prefixed console.log in production code

BAD:
  console.log(`🚀 fetchShopData: Starting...`);
  console.log(`📦 Got ${products.length} products`);

GOOD:
  # Option 1: Remove entirely
  # Option 2: Wrap in development check
  if (process.env.NODE_ENV === 'development') {
    console.log('[fetchShopData] Starting with priceListId:', priceListId);
  }
```

### Error Handling
```yaml
RULE: NEVER silently return empty arrays/null on errors
RULE: ALWAYS log the actual error before returning fallback
RULE: Differentiate error types (RateLimit, Auth, Validation)

BAD:
  catch (error) {
    return [];  # Silent failure - loses error context
  }

GOOD:
  catch (error) {
    console.error('[getProducts] Error:', error);
    if (isRateLimitError(error)) {
      return { products: [], error: 'rate_limit' };
    }
    throw error;  # Let caller handle unexpected errors
  }
```

### API Security
```yaml
RULES:
  - NEVER expose debug endpoints without authentication
  - ALWAYS validate webhook signatures cryptographically
  - NEVER hardcode secrets in source code (use env vars)
  - ALWAYS use rateLimitedFetch() for Zoho API calls
```

---

## Performance Checklist

Before deploying shop page changes:
```bash
# 1. Check TTFB (should be <1s for cached)
curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s "https://www.tsh.sale/ar/shop"

# 2. Verify cached response (2nd request faster)
curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s "https://www.tsh.sale/ar/shop"

# 3. Test build locally
npm run build

# 4. Run type check
npm run typecheck
```

---

## Stock Sync Health Check

If products show 0 stock unexpectedly:
```bash
# 1. Check Redis cache status
curl "https://www.tsh.sale/api/sync/stock?action=status&secret=tsh-stock-sync-2024"
# Should show itemCount: 400+

# 2. If itemCount < 100, trigger full sync
curl "https://www.tsh.sale/api/sync/stock?action=sync&secret=tsh-stock-sync-2024&force=true"
# Wait 3-5 minutes for completion

# 3. Revalidate caches after sync
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```

---

## Common Mistakes to Avoid

| Mistake | Why It's Bad | Correct Approach |
|---------|--------------|------------------|
| **Showing Consumer prices to logged-in customers** | Breaks B2B trust, customers expect their negotiated prices | Use `auth()` + `session.user.priceListId` on price pages |
| Using ISR on price-displaying pages | Caches Consumer prices for all users | Use `force-dynamic` for personalized pricing |
| Skipping `auth()` on shop page | Can't determine customer's price list | Always call `auth()` before fetching prices |
| Fetching prices without caching | 15+ API calls per request | Use `getProductsWithPrices()` |
| Ignoring rate limits | API blocks all requests | Use `rateLimitedFetch()` wrapper |
| Hardcoding price list IDs | Breaks when IDs change | Use `PRICE_LIST_IDS` constants |
| Using `warehouses` array | Zoho uses different field | Use `locations` array for stock |
| Deploying without typecheck | TypeScript errors in prod | Run `npm run typecheck` first |
| Using emoji console.log | Clutters production logs | Wrap in `NODE_ENV` check or remove |
| Silent error returns | Hides real issues | Log error, return typed error object |
| **Creating duplicate pages in route groups** | Build fails with "two parallel pages resolve to same path" | Check existing routes before creating pages in (main) or (public) |
| Throwing on 404 API responses | CRITICAL errors for expected scenarios | Handle 404 gracefully - resources may be deleted |
| Logging network errors as CRITICAL | Floods logs with noise | Use `warn` for transient errors, `error` for persistent |

---

## Build & Deployment Error Prevention

### Duplicate Page Error (CRITICAL)
```yaml
ERROR: You cannot have two parallel pages that resolve to the same path.

CAUSE: Next.js route groups like (main) and (public) create parallel routes.
       If both have /support/page.tsx, they resolve to the same URL.

PREVENTION:
  1. Before creating a page, check ALL route groups for existing pages
  2. Use command: find src/app -name "page.tsx" | grep -i "<pagename>"
  3. Each page should exist in ONLY ONE route group

EXAMPLE:
  ❌ Both exist:
     - src/app/[locale]/(main)/support/page.tsx
     - src/app/[locale]/(public)/support/page.tsx
  ✅ Only one:
     - src/app/[locale]/(public)/support/page.tsx
```

### Webhook 404 Errors (Expected Behavior)
```yaml
SCENARIO: Zoho sends webhooks for invoice.updated, item.updated, etc.
          But the resource may have been deleted by the time we fetch it.

WRONG:
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);  // CRITICAL error logged
  }

CORRECT:
  if (response.status === 404) {
    console.log(`Resource ${id} not found (deleted?) - skipping`);
    return { success: true, notFound: true };  // Graceful handling
  }
  if (!response.ok) {
    console.error(`API error: ${response.status}`);
    return { success: false, error: errorText };
  }

KEY PRINCIPLE: 404 "Resource does not exist" is NOT an error for webhooks.
              It means the resource was deleted - handle gracefully.
```

### Error Logging Levels
```yaml
Use appropriate log levels to avoid log pollution:

console.log():    Informational - normal flow, skipped operations
console.warn():   Transient issues - network errors, retries, rate limits
console.error():  Actual errors - API failures that affect functionality

WRONG: console.error(`❌ CRITICAL: ${error}`);  // For every failure
CORRECT:
  - 404 responses → console.log() (expected for deleted resources)
  - Network timeout → console.warn() (transient, will retry)
  - Auth failure → console.error() (needs investigation)
```

---

## Claude Code Documentation & Commands

### Slash Commands (11 Available)

| Command | Purpose |
|---------|---------|
| `/zoho-debug` | Debug Zoho API issues (token, rate limits, errors) |
| `/zoho-price` | Quick reference for price list rules and IDs |
| `/zoho-stock` | Stock calculation rules and warehouse info |
| `/zoho-sync` | Trigger cache revalidation and check sync |
| `/deploy` | Production deployment workflow with checklist |
| `/i18n-add` | Add new translations to EN and AR files |
| `/component-new` | Create new component with proper structure |
| `/api-new` | Create new API route with Zoho integration |
| `/diagnose` | Run comprehensive project health check |
| `/cache-clear` | Clear caches (products, prices, all) |
| `/logs` | View Vercel logs and debugging guide |

### Documentation Files (in `.claude/`)

| File | Purpose |
|------|---------|
| `PROJECT_MEMORY.md` | **READ EVERY SESSION** - Critical IDs, golden rules, file references |
| `ZOHO_INTEGRATION.md` | Complete Zoho API reference, auth flow, endpoints |
| `PRICING_RULES.md` | Price list logic, code examples, debugging |
| `STOCK_RULES.md` | Stock calculation, warehouse config, code examples |
| `TROUBLESHOOTING.md` | Decision trees for common issues |
| `COMPONENT_PATTERNS.md` | UI patterns, RTL, dark mode, responsive design |
| `DEPLOYMENT.md` | Deployment workflow and commands |
| `QUICK_REFERENCE.md` | 30-second quick facts |

### Quick Reference: Critical IDs

| Entity | ID | Notes |
|--------|-----|-------|
| Organization | `748369814` | Zoho org ID |
| **Main TSH Business** | `2646610000001123033` | Business location (order level) |
| **Main WareHouse** | `2646610000000077024` | Warehouse (line item level for stock) |
| Consumer Price List | `2646610000049149103` | Public visitors |
| Retailor USD | `2646610000004453985` | |
| Retailor IQD | `2646610000113426769` | |
| Technical IQD | `2646610000057419683` | |
| Technical USD | `2646610000045742089` | |
| Wholesale A USD | `2646610000004152175` | Cash wholesale |
| Wholesale A IQD | `2646610000113417534` | |
| Wholesale B USD | `2646610000004453961` | Credit wholesale |
| Wholesale B IQD | `2646610000113426003` | |

---

## Contact & Resources

- **Vercel Dashboard:** https://vercel.com/tsh-03790822/tsh-clients-console
- **Production URL:** https://www.tsh.sale
- **Zoho Books:** https://books.zoho.com/app#/748369814
- **Zoho Inventory:** https://inventory.zoho.com/app#/home/748369814

---

**Last Updated:** 2025-12-28
**Version:** 2.0.0

## Recent Changes (v2.0.0)
- **Webhook 404 Error Handling**: Fixed CRITICAL errors for expected 404 responses
  - Invoice webhooks now handle "Resource does not exist" gracefully
  - Returns `{ success: true, notFound: true }` instead of throwing errors
  - Reduces log noise from deleted invoices/items
- **Stock Sync Resilience**: Improved quickSyncStock error handling
  - 404 errors for deleted items handled gracefully (removed from cache)
  - Network errors (fetch failed, ECONNRESET) retry with backoff
  - Changed from `console.error` to `console.warn` for transient issues
- **Build Error Prevention Documentation**: Added guidelines to prevent deployment failures
  - Duplicate page error prevention (route groups conflict)
  - Webhook 404 handling patterns
  - Error logging level guidelines
- **Common Mistakes Table**: Added 3 new entries for route groups, 404 handling, and logging levels

## Previous Changes (v1.9.0)
- **CRITICAL FIX: Order Warehouse Fulfillment**: Fixed stock being deducted from wrong location
  - Problem: Orders took stock from Main TSH Business instead of Main WareHouse
  - Solution: Set `location_id` on LINE ITEMS (not `warehouse_id` at order level)
  - `warehouse_id` is NOT a valid parameter for Zoho Inventory sales orders
  - `location_id` must be on each line item to specify warehouse for stock fulfillment
  - Added MAIN_TSH_BUSINESS_ID and MAIN_WAREHOUSE_ID constants to orders.ts
  - Documentation: See "Order Creation & Warehouse Fulfillment" section above
- **Improved Error Handling**: Checkout API now surfaces actual Zoho error messages
- **Debug Endpoints Added**: `/api/debug/order-test` and `/api/debug/locations` for troubleshooting

## Previous Changes (v1.8.0)
- **Two-Branch Deployment Workflow**: New deployment strategy
  - `preview` branch → Auto-deploy to staging.tsh.sale via GitHub Actions
  - `main` branch → Production-ready code (NO auto-deploy, manual only)
  - Claude Code MUST work on `preview` branch only
  - Claude Code is FORBIDDEN from pushing to `main` branch
  - Production deployment is manual-only via Vercel Dashboard
- **Updated GitHub Actions**: Workflow now triggers on `preview` branch
- **Enhanced Deployment Rules**: Stricter production deployment prohibitions
- **User Configuration Required**: Vercel Dashboard settings for production auto-deploy disable

## Previous Changes (v1.7.0)
- **Enhanced Arabic RTL Experience**: Improved readability and typography for Arabic users
  - Larger stat numbers: `.stat-number` (2.5rem) and `.stat-currency` (2rem) classes
  - Even larger for Arabic: 2.75rem and 2.25rem respectively using Cairo font
  - Enhanced Arabic typography with better line-height (1.7) and heading sizes
  - Fixed RTL font family to use IBM Plex Sans Arabic for body text
- **Deployment Workflow Change**: GitHub-based CI/CD pipeline
  - Push to GitHub triggers automatic staging deployment (staging.tsh.sale)
  - User manually deploys to production after staging verification
  - Claude Code no longer deploys directly to production

## Previous Changes (v1.6.0)
- **Luxury Frontend Redesign**: Complete UI/UX overhaul with premium B2B aesthetics
  - Typography: Cormorant Garamond (serif display) + Plus Jakarta Sans (body)
  - Arabic Support: Cairo (display) + IBM Plex Sans Arabic (body)
  - Gold accent color system with HSL variables
  - Premium shadow system (--shadow-xs through --shadow-2xl, --shadow-gold, --shadow-glow)
  - New CSS utility classes: .font-display, .font-body, .price-tag, .price-display
- **Component Library Upgrade**:
  - Button: New variants (gold, luxury, premium-outline, success), new sizes (xl, icon-sm, icon-lg)
  - Card: CVA variants (elevated, premium, interactive, glass, outline, ghost)
  - Badge: New variants (gold, gold-subtle, glass, pending, confirmed, shipped, delivered)
  - Input: CVA variants (default, premium, ghost, error) with gold focus ring
  - Skeleton: New patterns (SkeletonCard, SkeletonText, SkeletonAvatar)
  - EmptyState: Pre-built empty states (EmptyCart, EmptyOrders, EmptySearch, EmptyProducts)
- **Layout Enhancements**:
  - Headers with gold gradient logo and refined backdrop blur
  - Menu drawer with premium avatar, gold ring styling, wholesale client badge
  - Product cards with serif fonts, image hover zoom, low stock warnings
- **Page Styling**:
  - Dashboard: Elevated stat cards with decorative circles, color-coded icons
  - Orders: Premium summary cards, gold status tabs, interactive order cards
  - Invoices: Elevated cards with status indicators, premium search inputs
- **Deployment**: Now triggers GitHub CI/CD to staging.tsh.sale

## Previous Changes (v1.5.0)
- **CRITICAL FIX**: Migrated from Zoho Inventory to Zoho Books API
  - All product fetching now uses Books API (`/items`, `/categories`, `/pricebooks`)
  - Image fetching uses Books API (`/items/{id}/image`)
  - Price lists use Books API (`/pricebooks`, `/items/pricebookrate`)
  - **Why:** Zoho Books has ~100 req/min limit vs Inventory's 3,750/day limit
  - This prevents API rate limiting issues that caused "No products found" errors
- Added rate limit error handling with user-friendly messages
- Added translations for rate limit errors (EN/AR)
- Created Playwright test suite (`scripts/test_all_pages.py`)
- Enhanced frontend design with new typography and animations
- Updated ZohoItem type to support both Books and Inventory API responses

## Previous Changes (v1.4.0)
- Fixed stock display to show "Available for Sale" instead of "Stock on Hand"
  - Changed from `warehouses` array to `locations` array (Zoho API naming)
  - Stock formula: `Available for Sale = Stock on Hand - Committed Stock`
- Added `/api/revalidate` endpoint for manual cache revalidation
- Added `/api/debug/stock` endpoint for stock debugging
- Added `WHOLESALE_WAREHOUSE_ID` constant for Zoho API filtering

## Previous Changes (v1.3.0)
- **CRITICAL FIX**: Implemented Upstash Redis for Zoho OAuth token caching
- Fixed "Contact for price" issue caused by Zoho OAuth rate limiting
- Added multi-tier caching: Memory → Upstash Redis → Vercel KV → Zoho refresh
- Added rate limit guard (10-second minimum between refresh attempts)
- Added comprehensive documentation for token caching architecture
- Removed @vercel/kv SDK dependency (uses direct REST API instead)

## Previous Changes (v1.2.0)
- Added comprehensive TSH Price Lists reference with all 6 active pricebooks
- Exported PRICE_LIST_IDS and PRICE_LIST_INFO constants from price-lists.ts
- Implemented Consumer price list for public visitors (IQD pricing)
- Added "Contact for price" display for items not in pricebook
- Updated CLAUDE.md with complete pricing documentation

## Previous Changes (v1.1.0)
- Replaced all mock data with real Zoho API data
- Added pagination support to Orders, Invoices, Payments, Credit Notes pages
- Implemented server-side data fetching for Dashboard
- Added real customer balance and order statistics
- Enhanced translations for EN/AR
- Root URL redirects to shop page
- TSH (Tech Supplies Hub) this wrong TSH Mean Tech Spider hand