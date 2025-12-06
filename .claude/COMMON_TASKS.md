# Common Tasks Runbook

Quick reference for frequent development tasks in TSH Clients Console.

---

## Adding a New Page

### 1. Create the Route
```bash
# Location: src/app/[locale]/(main)/[page-name]/page.tsx
# For public pages: src/app/[locale]/(public)/[page-name]/page.tsx
```

### 2. Create Page Component
```typescript
// src/app/[locale]/(main)/new-page/page.tsx
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("newPage");
  return { title: t("title") };
}

export default async function NewPage() {
  const t = await getTranslations("newPage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {/* Page content */}
    </div>
  );
}
```

### 3. Add Translations
```json
// src/messages/en.json
{
  "newPage": {
    "title": "New Page",
    "description": "Page description"
  }
}

// src/messages/ar.json
{
  "newPage": {
    "title": "صفحة جديدة",
    "description": "وصف الصفحة"
  }
}
```

### 4. Add Navigation Link (if needed)
```typescript
// src/components/layout/menu-drawer.tsx
// Add to navigation items array
```

---

## Adding a New API Endpoint

### 1. Create Route Handler
```typescript
// src/app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { zohoFetch } from "@/lib/zoho/client";

export async function GET(request: NextRequest) {
  try {
    const data = await zohoFetch("/books/v3/endpoint");
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /endpoint] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
```

### 2. Use Rate Limited Fetch
```typescript
// For Zoho API calls, always use the client wrapper
import { zohoFetch } from "@/lib/zoho/client";

// This handles:
// - OAuth token refresh
// - Rate limiting
// - Error handling
```

---

## Adding Translations

### 1. Add to English Messages
```json
// src/messages/en.json
{
  "section": {
    "newKey": "English text"
  }
}
```

### 2. Add Arabic Translation
```json
// src/messages/ar.json
{
  "section": {
    "newKey": "النص العربي"
  }
}
```

### 3. Use in Component
```typescript
import { useTranslations } from "next-intl";

function Component() {
  const t = useTranslations("section");
  return <p>{t("newKey")}</p>;
}
```

### 4. Test RTL
- Navigate to Arabic version: `/ar/page`
- Verify text alignment and layout
- Check icons have `rtl:rotate-180` for directional icons

---

## Debugging Production Issues

### 1. Check Vercel Logs
```bash
vercel logs www.tsh.sale --since 1h
# Or for staging:
vercel logs staging.tsh.sale --since 1h
```

### 2. Check Cache Status
```bash
# Stock cache status
curl "https://www.tsh.sale/api/sync/stock?action=status&secret=tsh-stock-sync-2024"

# If itemCount < 100, trigger full sync:
curl "https://www.tsh.sale/api/sync/stock?action=sync&secret=tsh-stock-sync-2024&force=true"
```

### 3. Revalidate Caches
```bash
# All caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"

# Specific cache
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

### 4. Check TTFB
```bash
curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s https://www.tsh.sale/ar/shop
```

---

## Modifying Zoho Integration

### 1. Key Files
```
src/lib/zoho/
├── client.ts       # OAuth, fetch wrapper
├── products.ts     # Product CRUD
├── price-lists.ts  # Price list logic
├── stock-cache.ts  # Redis stock caching
├── orders.ts       # Order operations
├── invoices.ts     # Invoice operations
└── customers.ts    # Customer data
```

### 2. Adding New API Endpoint
```typescript
// In appropriate file (e.g., src/lib/zoho/new-feature.ts)
import { zohoFetch, ZOHO_BOOKS_BASE, ZOHO_ORG_ID } from "./client";

export async function getNewData() {
  const response = await zohoFetch(
    `${ZOHO_BOOKS_BASE}/newEndpoint?organization_id=${ZOHO_ORG_ID}`
  );
  return response.data;
}
```

### 3. Caching Strategy
```typescript
import { unstable_cache } from "next/cache";

export const getCachedData = unstable_cache(
  async () => await fetchData(),
  ["data-cache-key"],
  { revalidate: 3600, tags: ["data"] } // 1 hour cache
);
```

---

## Performance Optimization

### 1. Check Current Performance
```bash
# TTFB check
curl -w "TTFB: %{time_starttransfer}s\n" -o /dev/null -s URL

# Should be < 1s for cached pages
```

### 2. Common Optimizations
- Use `unstable_cache` for Zoho API calls
- Use `useDeferredValue` for search inputs
- Add `revalidate` export for ISR
- Remove `force-dynamic` unless necessary

### 3. Image Optimization
- Use `next/image` with proper sizes
- Add preconnect hints for CDNs
- Use lazy loading for below-fold images

---

## Before Every Commit

```bash
# 1. Type check
npm run typecheck

# 2. Build check
npm run build

# 3. Lint
npm run lint

# 4. Ensure on preview branch
git branch --show-current  # Should show 'preview'
```

---

## Deployment Workflow

### For Claude Code
```bash
# 1. Ensure preview branch
git checkout preview

# 2. Commit changes
git add -A
git commit -m "feat: description"

# 3. Push (triggers staging deploy)
git push origin preview

# 4. Verify on staging.tsh.sale
```

### For User (Production)
```yaml
1. Verify changes on staging.tsh.sale
2. Go to Vercel Dashboard
3. Find latest successful deployment
4. Click "Promote to Production"
```
