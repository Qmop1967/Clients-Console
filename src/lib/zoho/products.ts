// ============================================
// Zoho Products/Items API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoItem, ZohoCategory, PaginatedResponse } from '@/types';

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

interface ZohoCategoriesResponse {
  categories: ZohoCategory[];
}

// Get all items with stock > 0 (cached)
export const getProductsInStock = unstable_cache(
  async (page = 1, perPage = 50): Promise<PaginatedResponse<ZohoItem>> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsResponse>('/items', {
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

      // Filter items with stock > 0
      const itemsInStock = data.items.filter(
        (item) => item.stock_on_hand > 0 || item.available_stock > 0
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
    revalidate: 300, // 5 minutes
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

// Get all items (including out of stock) - for catalog view
export const getAllProducts = unstable_cache(
  async (page = 1, perPage = 50): Promise<PaginatedResponse<ZohoItem>> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsResponse>('/items', {
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

      return {
        data: data.items,
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
    revalidate: 300,
    tags: [CACHE_TAGS.PRODUCTS],
  }
);

// Get single product by ID
export const getProduct = unstable_cache(
  async (itemId: string): Promise<ZohoItem | null> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemResponse>(`/items/${itemId}`, {
          api: 'inventory',
        })
      );

      return data.item || null;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  },
  ['product'],
  {
    revalidate: 300,
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
    revalidate: 3600, // 1 hour
    tags: [CACHE_TAGS.CATEGORIES],
  }
);

// Get products by category
export const getProductsByCategory = unstable_cache(
  async (
    categoryId: string,
    page = 1,
    perPage = 50
  ): Promise<PaginatedResponse<ZohoItem>> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoItemsResponse>('/items', {
          api: 'inventory',
          params: {
            page,
            per_page: perPage,
            category_id: categoryId,
            filter_by: 'Status.Active',
          },
        })
      );

      return {
        data: data.items,
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
    revalidate: 300,
    tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.CATEGORIES],
  }
);

// Search products
export async function searchProducts(
  query: string,
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<ZohoItem>> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoItemsResponse>('/items', {
        api: 'inventory',
        params: {
          page,
          per_page: perPage,
          search_text: query,
          filter_by: 'Status.Active',
        },
      })
    );

    return {
      data: data.items,
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
// ============================================
export const getAllProductsComplete = unstable_cache(
  async (): Promise<ZohoItem[]> => {
    const allProducts: ZohoItem[] = [];
    let currentPage = 1;
    const perPage = 200; // Max per page for efficiency
    let hasMorePages = true;

    try {
      while (hasMorePages) {
        const data = await rateLimitedFetch(() =>
          zohoFetch<ZohoItemsResponse>('/items', {
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
      return allProducts;
    } catch (error) {
      console.error('Error fetching all products:', error);
      return [];
    }
  },
  ['all-products-complete'],
  {
    revalidate: 300, // 5 minutes
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
    revalidate: 60, // 1 minute
    tags: [CACHE_TAGS.PRODUCTS],
  }
);
