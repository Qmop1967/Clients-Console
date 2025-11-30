Clear caches in TSH Clients Console.

## Quick Clear (Production)

```bash
# ALL caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```

## Selective Clear

```bash
# Products
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"

# Categories
curl "https://www.tsh.sale/api/revalidate?tag=categories&secret=tsh-revalidate-2024"

# Price lists
curl "https://www.tsh.sale/api/revalidate?tag=price-lists&secret=tsh-revalidate-2024"

# Warehouses
curl "https://www.tsh.sale/api/revalidate?tag=warehouses&secret=tsh-revalidate-2024"
```

## Cache Durations

| Type | Duration |
|------|----------|
| Products | 1 hour |
| Categories | 1 hour |
| Price Lists | 1 hour |
| OAuth Token | 50 min |
| Customer Data | 15 min |
| Orders | 5 min |

## Clear Token Cache (Upstash)

If OAuth token is corrupted:
1. Go to https://console.upstash.com
2. Find "clientsconsole" database
3. Data Browser → Delete `zoho:access_token`

## Local Development

```bash
rm -rf .next           # Clear Next.js cache
npm run dev            # Restart server
```

## When to Clear

- After deployment → all
- Price changes → price-lists
- Stock issues → products
- New products → products + categories
