# Quick Reference - TSH Clients Console

## 30-Second Facts

```yaml
Project: TSH Clients Console (B2B Wholesale Portal)
Stack: Next.js 15 + TypeScript + TailwindCSS + shadcn/ui
i18n: English + Arabic (RTL)
Auth: Magic Link via Resend
API: Zoho Books + Zoho Inventory
Deployment: Vercel (STAGING FIRST!)
Domain: www.tsh.sale
```

## Key Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run ESLint

# Deployment (STAGING FIRST!)
vercel --yes         # Deploy to staging
vercel --prod --yes  # Deploy to production (MANUAL ONLY)
```

## File Locations

| What | Where |
|------|-------|
| Pages | `src/app/[locale]/` |
| Components | `src/components/` |
| UI Components | `src/components/ui/` |
| Zoho Services | `src/lib/zoho/` |
| Auth Config | `src/lib/auth/` |
| Translations | `src/messages/` |
| i18n Config | `src/i18n/` |

## Important Files

- `CLAUDE.md` - Main instructions
- `.env.local` - Environment variables
- `src/lib/zoho/client.ts` - Zoho API client
- `src/lib/auth/auth.ts` - NextAuth config
- `src/messages/en.json` - English translations
- `src/messages/ar.json` - Arabic translations

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/auth/*` | NextAuth endpoints |
| `/api/webhooks/zoho` | Zoho webhook handler |

## Cache Tags

```typescript
CACHE_TAGS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  PRICE_LISTS: 'price-lists',
  CUSTOMER: (id) => `customer-${id}`,
  ORDERS: (id) => `orders-${id}`,
  INVOICES: (id) => `invoices-${id}`,
  PAYMENTS: (id) => `payments-${id}`,
  CREDIT_NOTES: (id) => `credit-notes-${id}`,
}
```

## Zoho Organization

- **Organization ID:** 748369814
- **API Domain:** https://www.zohoapis.com

## Remember

1. ALWAYS deploy to staging first
2. ALWAYS test before production
3. ALWAYS include Arabic translations
4. NEVER commit .env files
5. NEVER bypass the staging step
