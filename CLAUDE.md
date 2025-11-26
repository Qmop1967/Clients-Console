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
- **Shop Page**: Public product catalog with real Zoho Inventory data (200+ products)
- **Dashboard**: Real-time customer balance, order stats, recent orders/invoices from Zoho Books
- **Orders Page**: Full order history with pagination from Zoho Books
- **Invoices Page**: Invoice listing with status and pagination from Zoho Books
- **Payments Page**: Payment history with pagination from Zoho Books
- **Credit Notes Page**: Credit notes with available balance from Zoho Books
- **Authentication**: Magic link login via NextAuth.js v5
- **Internationalization**: English/Arabic with RTL support
- **Theme**: Light/Dark mode support

### Data Integration
All authenticated pages now fetch REAL data from Zoho APIs:
- Products from Zoho Inventory (`/items` endpoint)
- Categories from Zoho Inventory (`/categories` endpoint)
- Price Lists from Zoho Inventory (`/pricebooks` endpoint)
- Orders from Zoho Books (`/salesorders` endpoint)
- Invoices from Zoho Books (`/invoices` endpoint)
- Payments from Zoho Books (`/customerpayments` endpoint)
- Credit Notes from Zoho Books (`/creditnotes` endpoint)
- Customer Data from Zoho Books (`/contacts` endpoint)

### Caching Strategy
- Products: 1 hour cache with `unstable_cache`
- Orders/Invoices/Payments: 2 minutes cache
- Customer data: 5 minutes cache
- Price lists: 1 hour cache
- Webhook-based revalidation available

---

## Deployment Rules

### CRITICAL: Staging-First Deployment Policy

```yaml
DEPLOYMENT WORKFLOW:
  1. ALWAYS deploy to STAGING first
  2. VERIFY all changes on staging
  3. ONLY deploy to PRODUCTION after manual approval

Commands:
  Staging:    vercel --yes
  Production: vercel --prod --yes  (MANUAL ONLY after verification)

URLs:
  Staging:    https://staging.tsh.sale (linked to develop branch)
  Production: https://www.tsh.sale
              https://tsh-clients-console.vercel.app
```

### Deployment Checklist

Before deploying to PRODUCTION:
- [ ] Deploy to staging: `vercel --yes`
- [ ] Test all pages load correctly
- [ ] Verify Arabic/RTL layout works
- [ ] Test authentication flow
- [ ] Check Zoho API integration
- [ ] Verify responsive design
- [ ] Get explicit user approval
- [ ] Then deploy: `vercel --prod --yes`

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

# Deploy to STAGING (default)
vercel --yes

# Deploy to PRODUCTION (manual only)
vercel --prod --yes
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
- NEVER deploy directly to production
- ALWAYS test on staging first
- ALWAYS get explicit approval before production deploy
- NEVER skip the verification step

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
  Warehouse: WholeSale WareHouse (Warehouse)
  Field: Available for Sale (available_stock)

  NEVER use:
    - Physical Stock
    - Stock from other warehouses (TSH WholeSale Sales, Retail WareHouse, TSH Retail Store)
    - Stock on Hand (use Available for Sale instead)
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

### TSH Price Lists Reference (Updated: 2025-11-26)

| ID | Name | Currency | Type | Description |
|----|------|----------|------|-------------|
| `2646610000049149103` | **Consumer** | IQD | Individual Items | المستهلك - Public visitors and individual consumers |
| `2646610000004453985` | **Retailor** | USD | Individual Items | التجزئة - Retail shops and small quantity dealers |
| `2646610000057419683` | **Technical IQD** | IQD | Individual Items | الفني (دينار) - Technicians with IQD pricing |
| `2646610000045742089` | **Technical USD** | USD | Individual Items | الفني (دولار) - Technicians with USD pricing |
| `2646610000004152175` | **Wholesale A** | USD | Individual Items | جملة أ - Cash wholesale, large quantities (نقدي) |
| `2646610000004453961` | **Wholesale B** | USD | Individual Items | جملة ب - Credit wholesale, large quantities (اجل) |

### Price List Assignment Logic

```typescript
// src/lib/zoho/price-lists.ts exports:
import { PRICE_LIST_IDS, PRICE_LIST_INFO } from '@/lib/zoho/price-lists';

// Get price list for any scenario:
// 1. Public visitor → PRICE_LIST_IDS.CONSUMER
// 2. Authenticated → customer.price_list_id || PRICE_LIST_IDS.CONSUMER
// 3. Retail shop → PRICE_LIST_IDS.RETAILOR
// 4. Technician (IQD) → PRICE_LIST_IDS.TECHNICAL_IQD
// 5. Technician (USD) → PRICE_LIST_IDS.TECHNICAL_USD
// 6. Wholesale cash → PRICE_LIST_IDS.WHOLESALE_A
// 7. Wholesale credit → PRICE_LIST_IDS.WHOLESALE_B
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
| www.tsh.sale | Production | Configured |
| tsh-clients-console.vercel.app | Vercel default | Active |
| staging URLs | Preview deployments | Auto-generated |

DNS Configuration (Namecheap):
- `www` CNAME → `cname.vercel-dns.com`
- `_vercel` TXT → Verification record

---

## Session Checklist

At the start of EVERY session:
- [ ] Read this CLAUDE.md file
- [ ] Check current git branch
- [ ] Review recent changes: `git log --oneline -5`
- [ ] Understand the task before coding
- [ ] Remember: STAGING FIRST, then PRODUCTION

---

## Contact & Resources

- **Vercel Dashboard:** https://vercel.com/tsh-03790822/tsh-clients-console
- **Production URL:** https://www.tsh.sale
- **Zoho Books:** https://books.zoho.com/app#/748369814
- **Zoho Inventory:** https://inventory.zoho.com/app#/home/748369814

---

**Last Updated:** 2025-11-27
**Version:** 1.3.0

## Recent Changes (v1.3.0)
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
