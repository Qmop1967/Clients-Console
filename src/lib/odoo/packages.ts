// ============================================
// Packages API - Fetch packages for customer
// ============================================

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3010';
const API_KEY = process.env.API_KEY || 'tsh-client-2026-key';

export interface ClientPackage {
  id: number;
  name: string;
  pack_date: string | false;
  package_type: string;
  location: string;
  items: PackageItem[];
  total_items: number;
  create_date: string;
}

export interface PackageItem {
  product_id: [number, string] | number;
  quantity: number;
  location_id: [number, string] | number;
}

/**
 * Get packages for a customer via gateway
 */
export async function getCustomerPackages(partnerId: string): Promise<{ packages: ClientPackage[]; total: number }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/packages?limit=100`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-role': 'client',
        'x-partner-id': partnerId,
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const packages = (data.data?.packages || []).map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name || `PKG-${pkg.id}`,
      pack_date: pkg.pack_date || pkg.create_date,
      package_type: pkg.package_type_id ? (Array.isArray(pkg.package_type_id) ? pkg.package_type_id[1] : '') : '',
      location: pkg.location_id ? (Array.isArray(pkg.location_id) ? pkg.location_id[1] : '') : '',
      items: pkg.items || [],
      total_items: pkg.total_items || 0,
      create_date: pkg.create_date,
    }));

    return { packages, total: data.data?.total || packages.length };
  } catch (error) {
    console.error('[Packages] Error:', error);
    return { packages: [], total: 0 };
  }
}
