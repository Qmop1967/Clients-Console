# TSH Clients Console - Troubleshooting Guide

Complete troubleshooting guide with decision trees for common issues.

---

## Issue 1: All Products Show "Contact for Price"

### Decision Tree
```
Product Shows "Contact for Price"
│
├── Step 1: Check Upstash Redis configured?
│   │
│   ├── NO → Missing env vars in Vercel
│   │   ├── Go to Vercel → Settings → Environment Variables
│   │   ├── Add UPSTASH_REDIS_REST_URL
│   │   ├── Add UPSTASH_REDIS_REST_TOKEN
│   │   └── Redeploy: vercel --prod --yes
│   │
│   └── YES → Continue to Step 2
│
├── Step 2: Check token endpoint
│   │   curl "https://www.tsh.sale/api/debug/token"
│   │
│   ├── "Rate limited" → Token cache broken
│   │   ├── Check Upstash console for cached token
│   │   ├── Delete corrupted token if exists
│   │   └── Wait 10 seconds, retry
│   │
│   ├── "Token expired" → Refresh token invalid
│   │   ├── Generate new refresh token in Zoho
│   │   ├── Update ZOHO_REFRESH_TOKEN in Vercel
│   │   └── Redeploy
│   │
│   └── "Success" → Continue to Step 3
│
├── Step 3: Check prices endpoint
│   │   curl "https://www.tsh.sale/api/debug/prices"
│   │
│   ├── "Item not in pricebook" → Zoho configuration
│   │   ├── Go to Zoho Inventory → Pricebooks
│   │   ├── Open Consumer pricebook
│   │   ├── Add missing items
│   │   └── Revalidate: /api/revalidate?tag=price-lists
│   │
│   └── "Prices fetched" → Cache issue
│       └── Revalidate: /api/revalidate?tag=all
│
└── Step 4: Still broken?
    ├── Check Vercel function logs: vercel logs --prod
    ├── Look for error messages
    └── Check ZOHO_ORGANIZATION_ID = 748369814
```

### Quick Fix Commands
```bash
# Check token status
curl "https://www.tsh.sale/api/debug/token"

# Check prices
curl "https://www.tsh.sale/api/debug/prices"

# Revalidate all caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```

---

## Issue 2: Stock Shows 0 But Product Has Inventory

### Decision Tree
```
Stock Shows 0
│
├── Step 1: Which warehouse is being used?
│   │
│   ├── NOT "WholeSale WareHouse" → Wrong warehouse
│   │   ├── Code must use ID: 2646610000000077024
│   │   ├── Check src/lib/zoho/products.ts
│   │   └── Fix getWholesaleAvailableStock()
│   │
│   └── Correct warehouse → Continue to Step 2
│
├── Step 2: Which field is being used?
│   │
│   ├── Using warehouse_available_stock → Wrong field
│   │   ├── Must use: location_available_for_sale_stock
│   │   ├── From: locations array (NOT warehouses)
│   │   └── Fix in products.ts
│   │
│   └── Using correct field → Continue to Step 3
│
├── Step 3: List page or Detail page?
│   │
│   ├── List page → May lack locations data
│   │   ├── List endpoint doesn't return locations
│   │   ├── Must use warehouse_id filter
│   │   └── Or fetch individual items
│   │
│   └── Detail page → Should have accurate data
│       └── Continue to Step 4
│
├── Step 4: Check Zoho Inventory
│   │
│   ├── Go to Zoho Inventory → Items
│   ├── Find the product
│   ├── Check "Stock on Hand" and "Committed Stock"
│   │
│   ├── All committed → No available stock
│   │   └── Stock on Hand - Committed = Available
│   │
│   └── Has available → Cache issue
│       └── Revalidate products cache
│
└── Step 5: Revalidate and verify
    curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

### Code Fix Reference
```typescript
// CORRECT implementation in src/lib/zoho/products.ts
export function getWholesaleAvailableStock(item: ZohoItem): number {
  const WHOLESALE_WAREHOUSE_ID = '2646610000000077024';

  // Use locations array (NOT warehouses)
  const location = item.locations?.find(
    loc => loc.location_id === WHOLESALE_WAREHOUSE_ID
  );

  // Use location_available_for_sale_stock (NOT warehouse_available_stock)
  return location?.location_available_for_sale_stock ?? item.available_stock ?? 0;
}
```

---

## Issue 3: Arabic/RTL Layout Broken

### Decision Tree
```
RTL Layout Issues
│
├── Step 1: Is locale set correctly?
│   │
│   ├── URL shows /ar/ → Locale correct
│   │
│   └── URL shows /en/ → Wrong locale
│       └── Navigate to Arabic version manually
│
├── Step 2: Is dir="rtl" on html tag?
│   │
│   ├── Check src/app/[locale]/layout.tsx
│   ├── Should have: <html dir={locale === 'ar' ? 'rtl' : 'ltr'}>
│   │
│   └── Missing → Add direction attribute
│
├── Step 3: Are translations loading?
│   │
│   ├── Shows English text in Arabic → Missing translation
│   │   ├── Check src/messages/ar.json
│   │   ├── Add missing key
│   │   └── Use same key as en.json
│   │
│   └── Shows translation keys → Error loading messages
│       └── Check i18n configuration
│
├── Step 4: Layout direction wrong?
│   │
│   ├── Icons pointing wrong way → Add rtl: variants
│   │   └── Example: className="rtl:rotate-180"
│   │
│   ├── Margins/padding wrong → Use logical properties
│   │   └── Use ms-4 (margin-start) instead of ml-4
│   │
│   └── Text alignment wrong → Use text-start/text-end
│
└── Step 5: Test in browser
    ├── Visit: https://www.tsh.sale/ar/shop
    ├── Check header flows right-to-left
    ├── Check product cards layout
    └── Check all text is Arabic
```

### RTL Tailwind Classes
```css
/* Directional classes */
ms-4     /* margin-start (left in LTR, right in RTL) */
me-4     /* margin-end */
ps-4     /* padding-start */
pe-4     /* padding-end */
text-start
text-end

/* RTL variants */
rtl:rotate-180   /* Flip icons */
rtl:space-x-reverse  /* Reverse flex spacing */
rtl:flex-row-reverse /* Reverse row direction */
```

---

## Issue 4: Login Not Working

### Decision Tree
```
Login Issues
│
├── Step 1: Magic link email not received?
│   │
│   ├── Check spam folder
│   │
│   ├── Email not in spam → Check Resend
│   │   ├── Verify RESEND_API_KEY in Vercel
│   │   ├── Check Resend dashboard for failures
│   │   └── Verify EMAIL_FROM domain is verified
│   │
│   └── Email received → Continue to Step 2
│
├── Step 2: Link clicked but error?
│   │
│   ├── "Callback URL mismatch" → NEXTAUTH_URL wrong
│   │   ├── Check NEXTAUTH_URL = https://www.tsh.sale
│   │   └── Redeploy after fixing
│   │
│   ├── "Invalid token" → Link expired or used
│   │   └── Request new magic link
│   │
│   └── Other error → Check Vercel logs
│
├── Step 3: Session not persisting?
│   │
│   ├── Check NEXTAUTH_SECRET is set
│   ├── Check cookies are enabled in browser
│   │
│   └── Check domain configuration
│       └── Cookie domain should match site domain
│
└── Step 4: Zoho customer not found?
    ├── User logged in but no data
    ├── Check email exists in Zoho Books contacts
    └── Check getZohoCustomerByEmail() in auth callback
```

### Environment Variables for Auth
```bash
NEXTAUTH_URL=https://www.tsh.sale
NEXTAUTH_SECRET=<long-random-secret>
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=TSH <noreply@tsh.sale>
```

---

## Issue 5: Deployment Fails

### Decision Tree
```
Deployment Failed
│
├── Step 1: Build error?
│   │
│   ├── TypeScript errors → Fix type issues
│   │   ├── Run: npm run build locally
│   │   ├── Fix all type errors
│   │   └── Commit and redeploy
│   │
│   ├── Import errors → Check file paths
│   │   └── Use @ alias: @/lib/zoho/client
│   │
│   └── Dependencies → Check package.json
│       └── Run: npm install
│
├── Step 2: Environment variable missing?
│   │
│   ├── Check Vercel → Settings → Environment Variables
│   ├── Required vars:
│   │   ├── NEXTAUTH_URL
│   │   ├── NEXTAUTH_SECRET
│   │   ├── ZOHO_CLIENT_ID
│   │   ├── ZOHO_CLIENT_SECRET
│   │   ├── ZOHO_REFRESH_TOKEN
│   │   ├── ZOHO_ORGANIZATION_ID
│   │   ├── UPSTASH_REDIS_REST_URL
│   │   ├── UPSTASH_REDIS_REST_TOKEN
│   │   ├── RESEND_API_KEY
│   │   └── EMAIL_FROM
│   │
│   └── Add missing variables
│
├── Step 3: Function timeout?
│   │
│   ├── Check function duration in logs
│   ├── Zoho API slow? → Add timeout handling
│   └── Large data? → Add pagination
│
└── Step 4: Rollback if needed
    ├── Go to Vercel Dashboard
    ├── Find previous working deployment
    └── Promote to Production
```

---

## Quick Reference: Debug Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/debug/token` | Check OAuth token status |
| `/api/debug/prices` | Check price fetching |
| `/api/debug/stock` | Check stock display |
| `/api/revalidate?tag=all&secret=tsh-revalidate-2024` | Clear all caches |

---

## Quick Reference: Critical IDs

| Entity | ID |
|--------|-----|
| Organization | `748369814` |
| WholeSale Warehouse | `2646610000000077024` |
| Consumer Price List | `2646610000049149103` |

---

## Emergency Recovery

If everything is broken:

1. **Verify site is up**
   ```bash
   curl -I https://www.tsh.sale
   ```

2. **Check Vercel status**
   - https://www.vercel-status.com/

3. **Check Zoho status**
   - https://status.zoho.com/

4. **Rollback deployment**
   - Vercel Dashboard → Deployments → Previous → Promote

5. **Check all env vars**
   ```bash
   vercel env ls production
   ```

6. **Redeploy from clean state**
   ```bash
   vercel --prod --yes --force
   ```
