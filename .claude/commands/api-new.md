Create a new API route in TSH Clients Console.

## Location
`src/app/api/[route-name]/route.ts`

## Basic Template

```typescript
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    return NextResponse.json({ data: 'Success' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

## With Zoho Integration

```typescript
import { NextResponse } from 'next/server';
import { zohoFetch } from '@/lib/zoho/client';

export async function GET() {
  try {
    const data = await zohoFetch('/inventory/v1/items', {
      params: { organization_id: process.env.ZOHO_ORGANIZATION_ID },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Zoho Error:', error);
    return NextResponse.json({ error: 'Zoho API failed' }, { status: 500 });
  }
}
```

## With Authentication

```typescript
import { auth } from '@/lib/auth/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Protected logic here
}
```

## Zoho Endpoints Reference

| Endpoint | Product | Description |
|----------|---------|-------------|
| `/inventory/v1/items` | Inventory | Products |
| `/inventory/v1/pricebooks` | Inventory | Price lists |
| `/books/v3/salesorders` | Books | Orders |
| `/books/v3/invoices` | Books | Invoices |
| `/books/v3/contacts` | Books | Customers |

## Best Practices

1. Always handle errors
2. Use `zohoFetch` for Zoho calls
3. Check authentication for sensitive routes
4. Return proper status codes
