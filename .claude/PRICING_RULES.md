# TSH Clients Console - Pricing Rules

Complete pricing logic with code examples.

---

## Golden Rule

```
NEVER display item.rate (base sell price from Zoho)
ALWAYS fetch price from the appropriate pricebook
If item NOT in pricebook → show "Contact for price"
```

---

## Price List Reference

| ID | Name | Currency | Arabic | Use Case |
|-----|------|----------|--------|----------|
| `2646610000049149103` | Consumer | IQD | المستهلك | Public visitors (DEFAULT) |
| `2646610000004453985` | Retailor | USD | التجزئة | Retail shops |
| `2646610000057419683` | Technical IQD | IQD | الفني (دينار) | Technicians (IQD) |
| `2646610000045742089` | Technical USD | USD | الفني (دولار) | Technicians (USD) |
| `2646610000004152175` | Wholesale A | USD | جملة أ | Cash wholesale (نقدي) |
| `2646610000004453961` | Wholesale B | USD | جملة ب | Credit wholesale (اجل) |

---

## Price Selection Logic

### For Public Visitors (Not Logged In)
```typescript
import { PRICE_LIST_IDS } from '@/lib/zoho/price-lists';

// Always use Consumer price list
const priceListId = PRICE_LIST_IDS.CONSUMER; // IQD pricing
```

### For Authenticated Users
```typescript
import { PRICE_LIST_IDS } from '@/lib/zoho/price-lists';
import { getZohoCustomerByEmail } from '@/lib/zoho/customers';

// Get customer's assigned price list
const customer = await getZohoCustomerByEmail(session.user.email);
const priceListId = customer?.price_list_id || PRICE_LIST_IDS.CONSUMER;
```

---

## Code Implementation

### Constants (src/lib/zoho/price-lists.ts)

```typescript
export const PRICE_LIST_IDS = {
  CONSUMER: '2646610000049149103',       // IQD - Public
  RETAILOR: '2646610000004453985',       // USD - Retail
  TECHNICAL_IQD: '2646610000057419683',  // IQD - Tech
  TECHNICAL_USD: '2646610000045742089',  // USD - Tech
  WHOLESALE_A: '2646610000004152175',    // USD - Cash
  WHOLESALE_B: '2646610000004453961',    // USD - Credit
} as const;

export const PRICE_LIST_INFO = [
  { id: PRICE_LIST_IDS.CONSUMER, name: 'Consumer', currency: 'IQD', nameAr: 'المستهلك' },
  { id: PRICE_LIST_IDS.RETAILOR, name: 'Retailor', currency: 'USD', nameAr: 'التجزئة' },
  { id: PRICE_LIST_IDS.TECHNICAL_IQD, name: 'Technical IQD', currency: 'IQD', nameAr: 'الفني (دينار)' },
  { id: PRICE_LIST_IDS.TECHNICAL_USD, name: 'Technical USD', currency: 'USD', nameAr: 'الفني (دولار)' },
  { id: PRICE_LIST_IDS.WHOLESALE_A, name: 'Wholesale A', currency: 'USD', nameAr: 'جملة أ' },
  { id: PRICE_LIST_IDS.WHOLESALE_B, name: 'Wholesale B', currency: 'USD', nameAr: 'جملة ب' },
];
```

### Fetching Pricebook

```typescript
export async function getPriceList(priceListId: string) {
  const response = await zohoFetch(`/inventory/v1/pricebooks/${priceListId}`, {
    params: {
      organization_id: process.env.ZOHO_ORGANIZATION_ID,
    },
  });

  return response.pricebook;
  // Returns: { pricebook_id, name, currency_code, pricebook_items: [...] }
}
```

### Getting Price for Item

```typescript
export async function getPriceForItem(
  itemId: string,
  priceListId: string
): Promise<{ price: number; currency: string; inPriceList: boolean }> {
  const pricebook = await getPriceList(priceListId);

  const priceItem = pricebook.pricebook_items?.find(
    (item: any) => item.item_id === itemId
  );

  if (priceItem) {
    return {
      price: priceItem.pricebook_rate,
      currency: pricebook.currency_code,
      inPriceList: true,
    };
  }

  // Item not in pricebook
  return {
    price: 0,
    currency: pricebook.currency_code,
    inPriceList: false,
  };
}
```

---

## Display Logic

### Component Example

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface PriceDisplayProps {
  price: number;
  currency: string;
  inPriceList: boolean;
}

export function PriceDisplay({ price, currency, inPriceList }: PriceDisplayProps) {
  const t = useTranslations('products');

  if (!inPriceList) {
    return (
      <span className="text-muted-foreground">
        {t('contactForPrice')}
      </span>
    );
  }

  return (
    <span className="text-lg font-bold">
      {price.toLocaleString()} {currency}
    </span>
  );
}
```

### Translations

```json
// en.json
{
  "products": {
    "contactForPrice": "Contact for price"
  }
}

// ar.json
{
  "products": {
    "contactForPrice": "اتصل للسعر"
  }
}
```

---

## Product Card with Pricing

```typescript
interface ProductWithPrice {
  id: string;
  name: string;
  price: number;
  currency: string;
  inPriceList: boolean;
  stock: number;
}

export function ProductCard({ product }: { product: ProductWithPrice }) {
  const t = useTranslations('products');

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-medium">{product.name}</h3>

        {/* Price Display */}
        <div className="mt-2">
          {product.inPriceList ? (
            <span className="text-lg font-bold">
              {product.price.toLocaleString()} {product.currency}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('contactForPrice')}
            </span>
          )}
        </div>

        {/* Stock Display */}
        <Badge variant={product.stock > 0 ? 'default' : 'secondary'}>
          {product.stock > 0 ? t('inStock') : t('outOfStock')}
        </Badge>
      </CardContent>
    </Card>
  );
}
```

---

## Complete Flow: Public Shop Page

```typescript
// src/app/[locale]/(public)/shop/page.tsx

import { PRICE_LIST_IDS, getPriceList } from '@/lib/zoho/price-lists';
import { getAllProductsComplete } from '@/lib/zoho/products';

export default async function ShopPage() {
  // 1. Fetch products
  const products = await getAllProductsComplete();

  // 2. Fetch Consumer pricebook (for public visitors)
  const pricebook = await getPriceList(PRICE_LIST_IDS.CONSUMER);

  // 3. Create price lookup map
  const priceMap = new Map();
  pricebook.pricebook_items?.forEach((item: any) => {
    priceMap.set(item.item_id, {
      price: item.pricebook_rate,
      currency: pricebook.currency_code,
    });
  });

  // 4. Enrich products with prices
  const productsWithPrices = products.map(product => {
    const priceInfo = priceMap.get(product.item_id);
    return {
      ...product,
      price: priceInfo?.price || 0,
      currency: priceInfo?.currency || 'IQD',
      inPriceList: !!priceInfo,
    };
  });

  return <PublicProductsContent products={productsWithPrices} />;
}
```

---

## Debugging Prices

```bash
# Check prices endpoint
curl "https://www.tsh.sale/api/debug/prices"

# Revalidate price lists
curl "https://www.tsh.sale/api/revalidate?tag=price-lists&secret=tsh-revalidate-2024"
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| All "Contact for price" | Token rate limited | Check Upstash caching |
| Wrong prices | Wrong pricebook | Check priceListId used |
| Missing items | Item not in pricebook | Add to Zoho pricebook |
| Wrong currency | Wrong pricebook | Check PRICE_LIST_IDS |

---

## Price Updates

Prices are updated when:
1. **Webhook received** - `item.updated` event
2. **Cache expires** - 1 hour TTL
3. **Manual revalidation** - `/api/revalidate?tag=price-lists`

To force refresh after Zoho price change:
```bash
curl "https://www.tsh.sale/api/revalidate?tag=price-lists&secret=tsh-revalidate-2024"
```
