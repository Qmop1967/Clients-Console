Trigger cache revalidation and check sync status for TSH Clients Console.

## Revalidation Endpoint

```
Base URL: https://www.tsh.sale/api/revalidate
Auth: ?secret=tsh-revalidate-2024
```

## Revalidate Commands

```bash
# Revalidate ALL caches
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"

# Revalidate products only
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"

# Revalidate categories
curl "https://www.tsh.sale/api/revalidate?tag=categories&secret=tsh-revalidate-2024"

# Revalidate price lists
curl "https://www.tsh.sale/api/revalidate?tag=price-lists&secret=tsh-revalidate-2024"

# Revalidate warehouses
curl "https://www.tsh.sale/api/revalidate?tag=warehouses&secret=tsh-revalidate-2024"
```

## Available Tags

| Tag | What it revalidates |
|-----|---------------------|
| `products` | Product/item data from Zoho Inventory |
| `categories` | Product categories |
| `price-lists` | All pricebook data |
| `warehouses` | Warehouse/stock data |
| `all` | Everything |

## Cache Durations

| Data Type | Cache Duration |
|-----------|---------------|
| Products | 1 hour |
| Categories | 1 hour |
| Price Lists | 1 hour |
| Orders/Invoices | 5 minutes |
| Customer Data | 15 minutes |
| OAuth Token | 50 minutes (Upstash) |

## Webhook Sync

Zoho webhooks automatically trigger revalidation for:
- `item.created/updated/deleted` → products
- `salesorder.created/updated` → orders
- `invoice.created/updated/paid` → invoices
- `payment.created/updated` → payments
- `creditnote.created/updated` → credit notes

Webhook endpoint: `https://www.tsh.sale/api/webhooks/zoho`

## Manual Sync Scenarios

**After price changes in Zoho:**
```bash
curl "https://www.tsh.sale/api/revalidate?tag=price-lists&secret=tsh-revalidate-2024"
```

**After stock adjustment:**
```bash
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

**After new product added:**
```bash
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
curl "https://www.tsh.sale/api/revalidate?tag=categories&secret=tsh-revalidate-2024"
```

**After deployment:**
```bash
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```

## Stock Sync Cron Job

Automatic daily sync at 06:00 UTC:
- Endpoint: `/api/sync/stock`
- Configured in: `vercel.json`

## Code Location

- Revalidation endpoint: `src/app/api/revalidate/route.ts`
- Webhook handler: `src/app/api/webhooks/zoho/route.ts`
- Stock sync: `src/app/api/sync/stock/route.ts`
