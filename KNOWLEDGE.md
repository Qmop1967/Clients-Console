# TSH Clients Console - Complete Knowledge Base

**Comprehensive documentation of the TSH B2B Wholesale Portal**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Context](#2-business-context)
3. [Technical Stack](#3-technical-stack)
4. [Architecture](#4-architecture)
5. [Critical IDs & Constants](#5-critical-ids--constants)
6. [Core Features](#6-core-features)
7. [Data Flow](#7-data-flow)
8. [API Integration](#8-api-integration)
9. [Deployment & CI/CD](#9-deployment--cicd)
10. [Recent Updates](#10-recent-updates)
11. [Common Issues & Solutions](#11-common-issues--solutions)

---

## 1. Project Overview

### What is TSH Clients Console?

TSH Clients Console is a **B2B wholesale self-service portal** for Tech Spider Hand (TSH) company's wholesale clients in Iraq. It enables retailers, technicians, and resellers to:

- Browse TSH's product catalog with real-time stock availability
- View customer-specific wholesale pricing (IQD/USD)
- Place orders directly
- Track order history, invoices, and payments
- Manage their business accounts

### Key Value Propositions

- **Self-Service**: Reduces phone/email order volume
- **Real-Time Data**: Live stock and pricing from Zoho
- **Multi-Language**: Full Arabic (RTL) + English support
- **Customer-Specific**: Each client sees their own prices and order history
- **Mobile-Ready**: Works on phones/tablets for on-the-go ordering

---

## 2. Business Context

### TSH Company

**Name**: Tech Spider Hand (TSH)
**Location**: Baghdad, Iraq
**Business**: Wholesale distribution of electronics, mobile accessories, tech products
**Market**: Iraqi market (primarily Baghdad)

### Customer Types

| Type | Price List | Currency | Payment Terms |
|------|-----------|----------|---------------|
| **Retailers** | Retailor | USD/IQD | Cash or credit |
| **Technicians** | Technical | USD/IQD | Cash |
| **Wholesale A** | Wholesale A | USD/IQD | Cash wholesale |
| **Wholesale B** | Wholesale B | USD/IQD | Credit wholesale |
| **Public Visitors** | Consumer | IQD | N/A (browse only) |

### Business Locations

TSH operates two business units in Zoho:

1. **Main TSH Business** (Wholesale Operations)
   - Primary business location for B2B sales
   - Contains "Main WareHouse" for wholesale inventory
   - **This console uses this location exclusively**

2. **TSH Retail Dora** (Retail Operations)
   - Retail shop operations
   - Contains "Dora Store" warehouse
   - **Not used by this console**

---

## 3. Technical Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.5.7 | React framework with App Router |
| **React** | 19.2.1 | UI library |
| **TypeScript** | 5.x | Type safety |
| **TailwindCSS** | 4.x | Utility-first CSS |
| **shadcn/ui** | Latest | Component library |
| **next-intl** | 4.5.5 | Internationalization (AR/EN + RTL) |
| **next-themes** | 0.4.6 | Dark mode support |

### Backend & Integration

| Technology | Purpose |
|------------|---------|
| **Zoho Books API** | Primary API - Orders, Products, Invoices, Customers (higher rate limits) |
| **Zoho Inventory API** | Secondary API - Stock-only (warehouse-specific data) |
| **NextAuth.js v5** | Authentication (Magic Link + OTP) |
| **Upstash Redis** | OAuth token caching + Stock caching |
| **Vercel Blob** | Product image storage |
| **Resend** | Email delivery (magic links, OTP) |

### Infrastructure

| Service | Purpose |
|---------|---------|
| **Vercel** | Hosting, serverless functions, edge network |
| **Upstash** | Redis for caching (serverless-friendly) |
| **GitHub Actions** | CI/CD pipeline |
| **Zoho** | ERP system (source of truth) |

---

## 4. Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TSH CLIENTS CONSOLE                             │
│                     (Next.js 15 App)                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐      ┌─────────────────┐      ┌────────────┐ │
│  │   Client Pages  │◄────►│  API Routes     │◄────►│  Zoho APIs │ │
│  │  (AR/EN + RTL)  │      │  (Server-side)  │      │  (Books/   │ │
│  │                 │      │                 │      │  Inventory)│ │
│  └─────────────────┘      └─────────────────┘      └────────────┘ │
│         │                         │                        │       │
│         │                         ▼                        │       │
│         │                  ┌─────────────────┐             │       │
│         │                  │ Upstash Redis   │             │       │
│         │                  │  - OAuth token  │             │       │
│         │                  │  - Stock cache  │             │       │
│         │                  └─────────────────┘             │       │
│         │                                                  │       │
│         │                  ┌─────────────────┐             │       │
│         └─────────────────►│  Vercel Blob    │             │       │
│                            │ Product Images  │             │       │
│                            └─────────────────┘             │       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              WEBHOOK SYNC (Real-Time Stock)                  │  │
│  │  Zoho Transaction → POST /api/webhooks/zoho → Update Cache   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Product Browsing

```
User visits shop page
       │
       ▼
Next.js Server Component
       │
       ├─► Fetch products from Zoho Books API (with price list)
       │
       ├─► Get stock from Redis cache (Main WareHouse only)
       │
       └─► Render with prices + stock
              │
              ▼
           Client sees:
           - Product name/image
           - Their price (based on price list)
           - Real-time stock status
           - Add to cart button
```

### Data Flow: Order Placement

```
User adds items to cart
       │
       ▼
Reviews cart (with stock validation)
       │
       ▼
Submits order
       │
       ▼
POST /api/orders/create
       │
       ├─► Validate stock availability
       │
       ├─► Create Sales Order in Zoho Books API
       │   - location_id at ORDER level: Main TSH Business
       │   - location_id on LINE ITEMS: Main WareHouse
       │
       ├─► Zoho commits stock automatically
       │
       └─► Webhook fires → Update stock cache
              │
              ▼
           Success confirmation shown to user
```

---

## 5. Critical IDs & Constants

### Organization

```typescript
ZOHO_ORGANIZATION_ID = "748369814"
```

### Locations & Warehouses

| Entity | ID | Name |
|--------|-----|------|
| **Business Location** | `2646610000001123033` | Main TSH Business |
| **Warehouse (Stock Source)** | `2646610000000077024` | Main WareHouse |

### Price Lists

| Customer Type | USD | IQD |
|---------------|-----|-----|
| **Consumer** (Public) | N/A | `2646610000049149103` |
| **Retailor** | `2646610000004453985` | `2646610000113426769` |
| **Technical** | `2646610000045742089` | `2646610000057419683` |
| **Wholesale A** | `2646610000004152175` | `2646610000113417534` |
| **Wholesale B** | `2646610000004453961` | `2646610000113426003` |

### Redis Keys

```typescript
STOCK_CACHE_KEY = "stock:wholesale_map"
STOCK_SYNC_LOCK_KEY = "stock:sync_lock"
OAUTH_TOKEN_KEY = "zoho:access_token"
```

---

## 6. Core Features

### 1. Product Catalog

**Pages:**
- `/[locale]/shop` - Main product listing
- `/[locale]/shop/[itemId]` - Product detail

**Features:**
- Search by name/SKU
- Category filtering
- Real-time stock display
- Customer-specific pricing
- Mobile-optimized images
- Minimum order quantity display

**Stock Display Logic:**
```typescript
// ALWAYS use Main WareHouse stock only
const stock = item.locations?.find(
  loc => loc.location_id === '2646610000000077024'
)?.location_available_for_sale_stock ?? 0;
```

### 2. Authentication

**Methods:**
- **Magic Link** (Email-based, passwordless)
- **OTP Code** (For mobile app, 6-digit code)

**Flow:**
1. User enters email
2. System sends magic link OR OTP code
3. User clicks link OR enters code
4. Session created (30 days)

**Mobile API:**
- `/api/mobile/auth/request-otp` - Send OTP
- `/api/mobile/auth/verify-otp` - Verify code
- `/api/mobile/auth/refresh` - Refresh token
- Access token expiry: 24 hours
- Refresh token expiry: 30 days

### 3. Order Management

**Customer Features:**
- View order history
- Track order status
- Download order PDFs
- View invoices and payments
- Credit note tracking

**Order Workflow:**
```
Cart → Review → Submit → Zoho Sales Order → Confirmation Email
```

### 4. Real-Time Stock Sync

**4-Layer Architecture:**

1. **Webhooks** (Instant, < 5s)
   - Zoho transaction → POST `/api/webhooks/zoho`
   - Syncs affected items immediately
   - Updates Redis cache
   - Revalidates ISR pages

2. **Cron Job** (Every 15 minutes)
   - Vercel Cron → POST `/api/sync/stock`
   - Full catalog sync
   - Catches missed webhooks

3. **On-Demand** (Manual)
   - Admin trigger via API
   - Force sync all items
   - Used for troubleshooting

4. **Health Monitoring** (Continuous)
   - Cache age tracking
   - Item count monitoring
   - Error logging

### 5. Multilingual Support

**Languages:**
- English (LTR)
- Arabic (RTL with full UI mirror)

**Translation Files:**
- `src/messages/en.json`
- `src/messages/ar.json`

**RTL Features:**
- Automatic text direction
- Mirrored layouts
- Arabic-specific fonts (Cairo, IBM Plex Sans Arabic)
- Number formatting (Arabic numerals)

### 6. AI Assistant (Beta)

**Capabilities:**
- Product recommendations
- Order assistance
- Customer support
- Natural language queries in English/Arabic

**Tech:**
- OpenAI GPT-4
- Vector search (Upstash Vector)
- Product embeddings
- Conversation memory

---

## 7. Data Flow

### Stock Synchronization Flow

```
┌───────────────────────────────────────────────────────────────┐
│  ZOHO TRANSACTION (Invoice, Bill, Sales Order, etc.)         │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  WEBHOOK FIRES → POST /api/webhooks/zoho                      │
│  Payload: { event_type, data: { line_items: [...] } }        │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  PARSE WEBHOOK                                                │
│  - Extract item IDs from line_items                           │
│  - Identify event type (invoice, bill, salesorder, etc.)      │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  SYNC STOCK (AWAIT COMPLETION)                                │
│  - Call quickSyncStock(itemIds)                               │
│  - Fetch from Zoho Inventory API                              │
│  - Extract Main WareHouse stock                               │
│  - Update Redis cache                                         │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  REVALIDATE CACHES                                            │
│  - Next.js ISR cache (shop pages, product pages)              │
│  - Data cache tags (products, orders, invoices)               │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  RETURN RESPONSE                                              │
│  {                                                            │
│    "success": true,                                           │
│    "event": "salesorder.created",                            │
│    "stockSync": { "success": true, "itemsSynced": 5 }       │
│  }                                                            │
└───────────────────────────────────────────────────────────────┘
```

### Pricing Flow

```
User requests product
       │
       ▼
Check auth status
       │
       ├─► Not logged in → Use Consumer price list (IQD)
       │
       └─► Logged in → Fetch customer from Zoho
                       │
                       ├─► Has price_list_id → Use customer's list
                       │
                       └─► No price_list_id → Fallback to Consumer
                                  │
                                  ▼
                          Fetch price from Zoho Books API
                                  │
                                  ├─► Price found → Display price
                                  │
                                  └─► Not in pricebook → "Contact for price"
```

---

## 8. API Integration

### API Selection Rule (CRITICAL)

```yaml
Default: ALWAYS use Zoho Books API
Reason: Higher rate limits, lower cost, better reliability

Books API for:
  - Products/Items
  - Sales Orders (order submission)
  - Invoices
  - Payments
  - Credit Notes
  - Customers/Contacts
  - Price Lists

Inventory API ONLY for:
  - Stock levels (warehouse-specific)
  - Inventory adjustments
  - Stock sync operations

Rule: If data exists in both APIs, prefer Books API
```

### Zoho Books API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/items` | GET | List products |
| `/items/{id}` | GET | Product detail |
| `/salesorders` | POST | Create order |
| `/salesorders/{id}` | GET | Order detail |
| `/invoices` | GET | List invoices |
| `/customerpayments` | GET | List payments |
| `/creditnotes` | GET | List credit notes |
| `/contacts/{id}` | GET | Customer detail |
| `/pricebooklists/{id}` | GET | Price list items |

### Zoho Inventory API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/items/{id}` | GET | Get item with locations array (stock) |

### OAuth Token Management

**Challenge**: Serverless functions don't share memory

**Solution**: Upstash Redis caching

```typescript
// Token flow
1. Check in-memory cache (fast)
2. If not found, check Redis (medium)
3. If not found, refresh from Zoho (slow)
4. Store in Redis (TTL: 50 minutes)
5. Store in memory (current invocation only)
```

**Redis Key**: `zoho:access_token`
**TTL**: 50 minutes (Zoho tokens valid for 60 minutes)

---

## 9. Deployment & CI/CD

### Branch Strategy

```
preview branch  →  staging.tsh.sale  (automatic on push)
main branch     →  www.tsh.sale       (manual, user request only)
```

### Deployment Workflow

**Staging (Automatic):**
```bash
git checkout preview
git add -A
git commit -m "feat: ..."
git push origin preview
# → Vercel auto-deploys to staging.tsh.sale
```

**Production (Manual, on user request only):**
```bash
git checkout main
git merge preview
git push origin main
git checkout preview
# → Vercel auto-deploys to www.tsh.sale
```

### Environment Variables (Vercel)

**Required:**
```bash
# Zoho
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORGANIZATION_ID=748369814

# Redis (CRITICAL for token caching)
UPSTASH_REDIS_REST_URL=https://fine-mole-41883.upstash.io
UPSTASH_REDIS_REST_TOKEN=

# Auth
NEXTAUTH_URL=https://www.tsh.sale
NEXTAUTH_SECRET=

# Email
RESEND_API_KEY=
EMAIL_FROM=TSH <noreply@tsh.sale>

# Webhook
ZOHO_WEBHOOK_SECRET=

# Blob Storage
BLOB_READ_WRITE_TOKEN=
```

### Pre-Commit Checklist

```bash
# 1. Type check
npm run typecheck

# 2. Lint
npm run lint

# 3. Check for unused variables
# (linter catches these automatically)

# 4. Verify no duplicate pages
ls src/app/[locale]/(main)/ src/app/[locale]/(public)/

# 5. Run build locally
npm run build
```

---

## 10. Recent Updates

### 2026-01-24: Webhook Response Standardization

**Issue**: Non-stock events (payment, category, contact, etc.) were using `break` statements and falling through to generic responses, making debugging difficult.

**Fix**: Added explicit return statements with detailed responses for all event handlers.

**Benefits**:
- ✅ Consistent JSON response format
- ✅ Better debugging and monitoring
- ✅ Descriptive messages for each event type
- ✅ Event-specific data (customerId, contactId, stockSync status)

**Files Changed**:
- `src/app/api/webhooks/zoho/route.ts`

**Test Results**: All webhook events now return explicit responses with proper status codes.

### 2026-01-24: Order API Migration (Books vs Inventory)

**Issue**: Order submission was using Zoho Inventory API, which has lower rate limits and higher cost.

**Fix**: Migrated to Zoho Books API for all order operations.

**Changes**:
- Use Books API endpoint: `POST /books/v3/salesorders`
- Set `location_id` at ORDER level (Main TSH Business)
- Set `location_id` on LINE ITEMS (Main WareHouse)
- Remove invalid `warehouse_id` parameter

**Benefits**:
- ⚡ Higher rate limits
- 💰 Lower API cost
- ✅ Better reliability

### 2026-01-23: OTP Authentication for Mobile

**Addition**: Added OTP-based authentication alongside magic links for mobile app support.

**Features**:
- 6-digit OTP code sent via email
- Mobile API endpoints (`/api/mobile/auth/*`)
- JWT tokens (access + refresh)
- Access token: 24 hours (was 15 min - caused session issues)
- Refresh token: 30 days

**Files Added**:
- `src/app/api/mobile/auth/request-otp/route.ts`
- `src/app/api/mobile/auth/verify-otp/route.ts`
- `src/app/api/mobile/auth/refresh/route.ts`

### 2026-01-23: AI Assistant Integration

**Addition**: Intelligent chatbot for product recommendations and customer support.

**Tech Stack**:
- OpenAI GPT-4
- Upstash Vector (product embeddings)
- Streaming responses
- Multi-turn conversations

**Features**:
- Product search and recommendations
- Order assistance
- Arabic/English support
- Context-aware responses

### 2025-12-11: Real-Time Stock Webhook Sync

**Issue**: Stock updates had 15-minute delay (cron-only sync).

**Fix**: Implemented webhook-driven instant stock sync.

**Architecture**:
- Webhooks fire on Zoho transactions
- Extract affected item IDs
- Sync stock immediately (< 5s)
- Revalidate ISR pages
- Fallback to cron for missed webhooks

**Stock-Affecting Events**:
- Invoice, Bill, Sales Order, Credit Note
- Inventory Adjustment, Sales Return, Package Shipment

### 2025-11-27: Stock Display Fix

**Issue**: Stock showing incorrect values (total across all warehouses).

**Root Cause**: Using wrong field (`warehouse_available_stock` from `warehouses[]` array).

**Fix**: Changed to `location_available_for_sale_stock` from `locations[]` array.

**Result**: Stock now correctly shows only Main WareHouse inventory.

### 2025-11-26: Token Caching Implementation

**Issue**: All products showing "Contact for price".

**Root Cause**: Zoho OAuth rate limiting (serverless functions refreshing token on every request).

**Fix**: Implemented Upstash Redis for token caching (50-min TTL).

**Result**: Token shared across all serverless invocations, eliminating rate limit errors.

---

## 11. Common Issues & Solutions

### Issue: All Prices Show "Contact for Price"

**Symptoms**:
- Shop page shows "Contact for price" for all products
- Detail page same issue
- Logged-in users affected

**Root Cause**: OAuth token not cached, hitting Zoho rate limits.

**Solution**:
1. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel
2. Check token cache: `curl https://www.tsh.sale/api/debug/token`
3. Clear Redis cache if needed
4. Revalidate: `curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"`

### Issue: Stock Not Updating After Transaction

**Symptoms**:
- Stock doesn't change after creating invoice/order
- Webhook fires but stock stays same
- Manual sync works but webhooks don't

**Root Cause**: Webhook not waiting for stock sync completion before cache revalidation.

**Solution**:
1. Check Vercel logs for webhook execution
2. Search logs for `[quickSyncStock]` to see sync status
3. Verify webhook is calling `syncStockForItemsAndWait()` (not fire-and-forget)
4. Check Redis env vars are set
5. Trigger manual sync: `curl "https://www.tsh.sale/api/sync/stock?action=sync&force=true&secret=tsh-stock-sync-2024"`

### Issue: Wrong Stock Displayed

**Symptoms**:
- Stock numbers don't match Zoho
- Stock shows combined total (Main WareHouse + Dora Store)

**Root Cause**: Using `item.available_stock` instead of location-specific stock.

**Solution**:
1. Always use `getUnifiedStock(itemId)` function
2. Never access `item.available_stock` directly
3. Verify warehouse ID is `2646610000000077024`
4. Check `locations` array (not `warehouses`)

### Issue: 503 Timeout on Shop Pages

**Symptoms**:
- Shop page loads slowly or times out
- Browser shows 503 error
- Happens during traffic spikes

**Root Cause**: Sequential API calls causing function timeout.

**Solution**:
1. Use `Promise.all()` for parallel fetching
2. Increase `maxDuration` in `vercel.json` (30s for pages)
3. Implement Redis caching to reduce API calls
4. Monitor TTFB: `curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s "https://www.tsh.sale/ar/shop"`

### Issue: Mobile App Can't Authenticate

**Symptoms**:
- Magic link doesn't work on mobile
- Session expires too quickly (15 minutes)
- Users have to re-login constantly

**Root Cause**: Short access token expiry (was 15 minutes).

**Solution**:
1. Use OTP authentication for mobile (`/api/mobile/auth/*`)
2. Access token expiry increased to 24 hours
3. Implement refresh token flow (30-day expiry)
4. Store tokens securely on mobile device

### Issue: Order Submission Fails

**Symptoms**:
- Order creation returns error
- "Invalid warehouse_id" error
- Stock not committed

**Root Cause**: Using wrong API or invalid location parameters.

**Solution**:
1. Use Zoho Books API (NOT Inventory API)
2. Set `location_id` at ORDER level: Main TSH Business (`2646610000001123033`)
3. Set `location_id` on LINE ITEMS: Main WareHouse (`2646610000000077024`)
4. Remove `warehouse_id` parameter (invalid in Books API)

---

## Quick Reference Commands

```bash
# Check stock cache status
curl "https://www.tsh.sale/api/sync/stock?action=status&secret=tsh-stock-sync-2024"

# Force stock sync
curl "https://www.tsh.sale/api/sync/stock?action=sync&force=true&secret=tsh-stock-sync-2024"

# Revalidate all caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"

# Check webhook health
curl "https://www.tsh.sale/api/webhooks/zoho"

# Test webhook with sales order event
curl -X POST "https://www.tsh.sale/api/webhooks/zoho" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"salesorder.created","data":{"line_items":[{"item_id":"123"}]}}'

# Check TTFB
curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s "https://www.tsh.sale/ar/shop"

# View production logs
npx vercel logs --prod

# Deploy to staging
git push origin preview

# Deploy to production (manual)
git checkout main && git merge preview && git push origin main && git checkout preview
```

---

## URLs

| Environment | URL | Auto-Deploy |
|-------------|-----|-------------|
| **Production** | https://www.tsh.sale | main branch |
| **Staging** | https://staging.tsh.sale | preview branch |
| **Vercel Project** | https://vercel.com/tsh-03790822/tsh-clients-console | - |
| **Zoho Books** | https://books.zoho.com/app#/748369814 | - |
| **Zoho Inventory** | https://inventory.zoho.com/app#/home/748369814 | - |
| **Upstash Redis** | https://console.upstash.com | - |
| **GitHub Repo** | https://github.com/Qmop1967/Clients-Console | - |

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-24
**Maintained By:** TSH Development Team

---

## Document Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-24 | 1.0.0 | Initial comprehensive knowledge base created |
| 2026-01-24 | 1.0.1 | Added webhook response standardization updates |
| 2026-01-24 | 1.0.2 | Added Order API migration documentation |

---

**For technical implementation details, see:**
- `.claude/CLAUDE.md` - Development guidelines
- `.claude/TSH_ARCHITECTURE.md` - System architecture
- `.claude/STOCK_RULES.md` - Stock logic details
- `.claude/PRICING_RULES.md` - Pricing logic details
- `.claude/ZOHO_INTEGRATION.md` - Zoho API integration
