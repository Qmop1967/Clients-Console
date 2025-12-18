import { NextRequest, NextResponse } from 'next/server';
import { zohoFetch, rateLimitedFetch } from '@/lib/zoho/client';

// Debug endpoint to list Zoho locations and warehouses
// Usage: GET /api/debug/locations?secret=tsh-debug-2024

interface ZohoLocationsResponse {
  locations: Array<{
    location_id: string;
    location_name: string;
    is_primary_location: boolean;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  }>;
}

interface ZohoWarehousesResponse {
  warehouses: Array<{
    warehouse_id: string;
    warehouse_name: string;
    is_primary: boolean;
    status: string;
    address?: string;
  }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== 'tsh-debug-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch locations (business branches)
    const locationsPromise = rateLimitedFetch(() =>
      zohoFetch<ZohoLocationsResponse>('/settings/locations', {
        api: 'inventory',
      })
    ).catch(e => ({ locations: [], error: e.message }));

    // Fetch warehouses
    const warehousesPromise = rateLimitedFetch(() =>
      zohoFetch<ZohoWarehousesResponse>('/settings/warehouses', {
        api: 'inventory',
      })
    ).catch(e => ({ warehouses: [], error: e.message }));

    const [locations, warehouses] = await Promise.all([
      locationsPromise,
      warehousesPromise,
    ]);

    return NextResponse.json({
      locations,
      warehouses,
      usage: {
        location_id: 'Business location (branch) - set at order level',
        warehouse_id: 'Warehouse for stock fulfillment - set at order level',
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
