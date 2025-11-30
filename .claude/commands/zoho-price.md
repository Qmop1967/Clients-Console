Quick reference for TSH Clients Console pricing rules and price list IDs.

## Price List IDs (MEMORIZE)

| Price List | ID | Currency | Use Case |
|------------|-----|----------|----------|
| **Consumer** | `2646610000049149103` | IQD | Public visitors (default) |
| **Retailor** | `2646610000004453985` | USD | Retail shops |
| **Technical IQD** | `2646610000057419683` | IQD | Technicians (IQD) |
| **Technical USD** | `2646610000045742089` | USD | Technicians (USD) |
| **Wholesale A** | `2646610000004152175` | USD | Cash wholesale |
| **Wholesale B** | `2646610000004453961` | USD | Credit wholesale |

## Golden Rule

```
NEVER display item.rate (base sell price)
ALWAYS use price from appropriate pricebook
If item NOT in pricebook → show "Contact for price"
```

## Price Selection Logic

```typescript
// 1. Public visitor (not logged in)
priceListId = PRICE_LIST_IDS.CONSUMER; // IQD

// 2. Authenticated user
const customer = await getZohoCustomerByEmail(email);
priceListId = customer?.price_list_id || PRICE_LIST_IDS.CONSUMER;

// 3. Fetch price from pricebook
const price = await getPriceForItem(itemId, priceListId);
```

## Code Location

```
src/lib/zoho/price-lists.ts
├── PRICE_LIST_IDS (constant object)
├── PRICE_LIST_INFO (metadata array)
├── getPriceList(id) → Full pricebook with items
├── getPriceForItem(itemId, priceListId) → Single item price
└── getCustomerPriceList(email) → Customer's assigned list
```

## Checking Prices in Zoho

1. Go to Zoho Inventory → Settings → Pricebooks
2. Select the appropriate pricebook
3. Find the item and verify price is set
4. If missing, add item to pricebook

## Debug

```bash
# Check if prices are fetching correctly
curl "https://www.tsh.sale/api/debug/prices"

# Revalidate price cache
curl "https://www.tsh.sale/api/revalidate?tag=price-lists&secret=tsh-revalidate-2024"
```

## "Contact for price" Troubleshooting

1. Item not in Consumer pricebook → Add to Zoho Inventory pricebook
2. Token rate limited → Check Upstash Redis caching
3. API error → Check Vercel function logs
