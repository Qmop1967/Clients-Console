import { NextRequest, NextResponse } from 'next/server';
import { zohoFetch, rateLimitedFetch } from '@/lib/zoho/client';

// Debug endpoint to list Zoho locations and warehouses
// Usage: GET /api/debug/locations?secret=tsh-debug-2024

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResponse = any;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== 'tsh-debug-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, AnyResponse> = {};

  // Try multiple endpoints to find location/warehouse info
  const endpoints = [
    { name: 'warehouses_inventory', path: '/warehouses', api: 'inventory' as const },
    { name: 'warehouses_books', path: '/settings/warehouses', api: 'books' as const },
    { name: 'organization_inventory', path: '/organizations', api: 'inventory' as const },
    { name: 'organization_books', path: '/organization', api: 'books' as const },
  ];

  for (const ep of endpoints) {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<AnyResponse>(ep.path, { api: ep.api })
      );
      results[ep.name] = data;
    } catch (e) {
      results[ep.name] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Also get a sample item to see its warehouse/location structure
  try {
    const itemData = await rateLimitedFetch(() =>
      zohoFetch<AnyResponse>('/items/2646610000002505427', { api: 'inventory' })
    );
    results['sample_item'] = {
      item_id: itemData.item?.item_id,
      name: itemData.item?.name,
      warehouses: itemData.item?.warehouses,
      locations: itemData.item?.locations,
    };
  } catch (e) {
    results['sample_item'] = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(results);
}
