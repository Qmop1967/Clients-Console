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
  Staging:    https://tsh-clients-console-[hash]-tsh-03790822.vercel.app
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

**Last Updated:** 2025-11-26
**Version:** 1.1.0

## Recent Changes (v1.1.0)
- Replaced all mock data with real Zoho API data
- Added pagination support to Orders, Invoices, Payments, Credit Notes pages
- Implemented server-side data fetching for Dashboard
- Added real customer balance and order statistics
- Enhanced translations for EN/AR
- Root URL redirects to shop page
