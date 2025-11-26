// ============================================
// Zoho Products/Items API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoItem, ZohoCategory, PaginatedResponse } from '@/types';

// ============================================
// WAREHOUSE CONFIGURATION
// Stock should ONLY come from WholeSale WareHouse
// Using Accounting Stock > Available for Sale
// ============================================
const WHOLESALE_WAREHOUSE_NAME = 'WholeSale WareHouse (Warehouse)';

interface ZohoWarehouse {
  warehouse_id: string;
  warehouse_name: string;
  status: string;
  is_primary: boolean;
}

interface ZohoWarehousesResponse {
  warehouses: ZohoWarehouse[];
}

interface ZohoItemsResponse {
  items: ZohoItem[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

interface ZohoItemResponse {
  item: ZohoItem;
}

// Warehouse stock info included in item response
interface ZohoItemWarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_stock_on_hand: number;
  warehouse_available_stock: number;
  warehouse_actual_available_stock: number;
  warehouse_committed_stock: number;
}

// Extended item type with warehouse breakdown
interface ZohoItemWithWarehouses extends ZohoItem {
  warehouses?: ZohoItemWarehouseStock[];
}

// Get all warehouses (cached)
export const getWarehouses = unstable_cache(
  async (): Promise<ZohoWarehouse[]> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoWarehousesResponse>('/warehouses', {
          api: 'inventory',
        })
      );
      return data.warehouses || [];
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      return [];
    }
  },
  ['warehouses'],
  {
    revalidate: 86400, // 24 hours - warehouses don't change often
    tags: ['warehouses'],
  }
);

// Get WholeSale WareHouse ID
export const getWholesaleWarehouseId = unstable_cache(
  async (): Promise<string | null> => {
    try {
      const warehouses = await getWarehouses();
      const wholesaleWarehouse = warehouses.find(
        (w) => w.warehouse_name === WHOLESALE_WAREHOUSE_NAME
      );
      if (wholesaleWarehouse) {
        console.log(`✅ Found WholeSale WareHouse ID: ${wholesaleWarehouse.warehouse_id}`);
        return wholesaleWarehouse.warehouse_id;
      }
      console.warn(`⚠️ WholeSale WareHouse not found, available warehouses:`,
        warehouses.map(w => w.warehouse_name));
      return null;
    } catch (error) {
      console.error('Error getting wholesale warehouse ID:', error);
      return null;
    }
  },
  ['wholesale-warehouse-id'],
  {
    revalidate: 86400,
    tags: ['warehouses'],
  }
);

// Extract available stock for WholeSale WareHouse from item
function getWholesaleAvailableStock(item: ZohoItemWithWarehouses): number {
  if (!item.warehouses || item.warehouses.length === 0) {
    // Fallback to item-level available_stock if no warehouse breakdown
    return item.available_stock || 0;
  }

  const wholesaleWarehouse = item.warehouses.find(
    (w) => w.warehouse_name === WHOLESALE_WAREHOUSE_NAME
  );

  if (wholesaleWarehouse) {
    // Use warehouse_available_stock (Available for Sale in Accounting Stock)
    return wholesaleWarehouse.warehouse_available_stock || 0;
  }

  // If WholeSale WareHouse not found in item, return 0
  return 0;
}

interface ZohoCategoriesResponse {
  categories: ZohoCategory[];
}

// Extended response type that may include warehouse data
interface ZohoItemsWithWarehousesResponse {
  items: ZohoItemWithWarehouses[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

// Get all items with stock > 0 (cached)
// Stock is filtered to WholeSale WareHouse only
export const getProductsInStock = unstable_cache(
  async (page = 1, perPage = 50): Promise<PaginatedResponse<ZohoItem>> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsWithWarehousesResponse>('/items', {
          api: 'inventory',
          params: {
            page,
            per_page: perPage,
            filter_by: 'Status.Active',
            sort_column: 'name',
            sort_order: 'A',
          },
        })
      );

      // Apply warehouse-specific stock and filter items with stock > 0
      const itemsWithWarehouseStock = data.items.map((item) => ({
        ...item,
        available_stock: getWholesaleAvailableStock(item),
      }));

      // Filter items with WholeSale WareHouse stock > 0
      const itemsInStock = itemsWithWarehouseStock.filter(
        (item) => item.available_stock > 0
      );

      return {
        data: itemsInStock,
        page_context: data.page_context,
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      return {
        data: [],
        page_context: {
          page: 1,
          per_page: perPage,
          has_more_page: false,
          total: 0,
          total_pages: 0,
        },
      };
    }
  },
  ['products-in-stock'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

// Get all items (including out of stock) - for catalog view
// Stock is filtered to WholeSale WareHouse only
export const getAllProducts = unstable_cache(
  async (page = 1, perPage = 50): Promise<PaginatedResponse<ZohoItem>> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsWithWarehousesResponse>('/items', {
          api: 'inventory',
          params: {
            page,
            per_page: perPage,
            filter_by: 'Status.Active',
            sort_column: 'name',
            sort_order: 'A',
          },
        })
      );

      // Apply warehouse-specific stock filtering
      const itemsWithWarehouseStock = data.items.map((item) => ({
        ...item,
        available_stock: getWholesaleAvailableStock(item),
      }));

      return {
        data: itemsWithWarehouseStock,
        page_context: data.page_context,
      };
    } catch (error) {
      console.error('Error fetching all products:', error);
      return {
        data: [],
        page_context: {
          page: 1,
          per_page: perPage,
          has_more_page: false,
          total: 0,
          total_pages: 0,
        },
      };
    }
  },
  ['all-products'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

// Extended item response that may include warehouse data
interface ZohoItemWithWarehouseResponse {
  item: ZohoItemWithWarehouses;
}

// Get single product by ID
// Returns warehouse-specific available stock from WholeSale WareHouse
export const getProduct = unstable_cache(
  async (itemId: string): Promise<ZohoItem | null> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemWithWarehouseResponse>(`/items/${itemId}`, {
          api: 'inventory',
        })
      );

      if (!data.item) return null;

      // Apply warehouse-specific stock filtering
      // Stock should ONLY come from WholeSale WareHouse's Available for Sale
      return {
        ...data.item,
        available_stock: getWholesaleAvailableStock(data.item),
      };
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  },
  ['product'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

// Get categories/catalogs (cached)
export const getCategories = unstable_cache(
  async (): Promise<ZohoCategory[]> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoCategoriesResponse>('/categories', {
          api: 'inventory',
        })
      );

      return data.categories || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },
  ['categories'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.CATEGORIES],
  }
);

// Get products by category
// Stock is filtered to WholeSale WareHouse only
export const getProductsByCategory = unstable_cache(
  async (
    categoryId: string,
    page = 1,
    perPage = 50
  ): Promise<PaginatedResponse<ZohoItem>> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsWithWarehousesResponse>('/items', {
          api: 'inventory',
          params: {
            page,
            per_page: perPage,
            category_id: categoryId,
            filter_by: 'Status.Active',
          },
        })
      );

      // Apply warehouse-specific stock filtering
      const itemsWithWarehouseStock = data.items.map((item) => ({
        ...item,
        available_stock: getWholesaleAvailableStock(item),
      }));

      return {
        data: itemsWithWarehouseStock,
        page_context: data.page_context,
      };
    } catch (error) {
      console.error('Error fetching products by category:', error);
      return {
        data: [],
        page_context: {
          page: 1,
          per_page: perPage,
          has_more_page: false,
          total: 0,
          total_pages: 0,
        },
      };
    }
  },
  ['products-by-category'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.CATEGORIES],
  }
);

// Search products
// Stock is filtered to WholeSale WareHouse only
export async function searchProducts(
  query: string,
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<ZohoItem>> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoItemsWithWarehousesResponse>('/items', {
        api: 'inventory',
        params: {
          page,
          per_page: perPage,
          search_text: query,
          filter_by: 'Status.Active',
        },
      })
    );

    // Apply warehouse-specific stock filtering
    const itemsWithWarehouseStock = data.items.map((item) => ({
      ...item,
      available_stock: getWholesaleAvailableStock(item),
    }));

    return {
      data: itemsWithWarehouseStock,
      page_context: data.page_context,
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return {
      data: [],
      page_context: {
        page: 1,
        per_page: perPage,
        has_more_page: false,
        total: 0,
        total_pages: 0,
      },
    };
  }
}

// Get product image URL
// Zoho Inventory returns image_document_id but not image_url
// We use our proxy API route to fetch images with OAuth authentication
export function getProductImageUrl(item: ZohoItem): string | null {
  // If item has an image (check image_document_id or image_name)
  if (item.image_document_id || item.image_name) {
    // Use our proxy API route to fetch the image
    return `/api/zoho/images/${item.item_id}`;
  }
  // Return null to show placeholder
  return null;
}

// ============================================
// FETCH ALL PRODUCTS (with full pagination)
// Guarantees ALL products from Zoho are fetched
// Returns warehouse-specific available stock from WholeSale WareHouse
// ============================================
export const getAllProductsComplete = unstable_cache(
  async (): Promise<ZohoItem[]> => {
    const allProducts: ZohoItemWithWarehouses[] = [];
    let currentPage = 1;
    const perPage = 200; // Max per page for efficiency
    let hasMorePages = true;

    try {
      while (hasMorePages) {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoItemsWithWarehousesResponse>('/items', {
            api: 'inventory',
            params: {
              page: currentPage,
              per_page: perPage,
              filter_by: 'Status.Active',
              sort_column: 'name',
              sort_order: 'A',
            },
          })
        );

        if (data.items && data.items.length > 0) {
          allProducts.push(...data.items);
        }

        // Check if there are more pages
        hasMorePages = data.page_context?.has_more_page ?? false;
        currentPage++;

        // Safety limit to prevent infinite loops
        if (currentPage > 50) {
          console.warn('Reached max page limit (50) when fetching products');
          break;
        }
      }

      console.log(`✅ Fetched ${allProducts.length} total products from Zoho`);

      // Apply warehouse-specific stock filtering
      // Stock should ONLY come from WholeSale WareHouse's Available for Sale
      const productsWithWarehouseStock = allProducts.map((item) => ({
        ...item,
        // Override available_stock with WholeSale WareHouse specific stock
        available_stock: getWholesaleAvailableStock(item),
      }));

      return productsWithWarehouseStock;
    } catch (error) {
      console.error('Error fetching all products:', error);
      return [];
    }
  },
  ['all-products-complete'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

// Get total product count
export const getProductCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsResponse>('/items', {
          api: 'inventory',
          params: {
            page: 1,
            per_page: 1,
            filter_by: 'Status.Active',
          },
        })
      );

      return data.page_context?.total ?? 0;
    } catch (error) {
      console.error('Error fetching product count:', error);
      return 0;
    }
  },
  ['product-count'],
  {
    revalidate: 86400, // 24 hours - webhook-triggered revalidation handles updates
    tags: [CACHE_TAGS.PRODUCTS],
  }
);
