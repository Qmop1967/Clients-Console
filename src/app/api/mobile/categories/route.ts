// ============================================
// Mobile Categories API
// GET /api/mobile/categories
// ============================================

import { mobileSuccess, mobileError } from '@/lib/auth/mobile-middleware';
import { zohoFetch, rateLimitedFetch } from '@/lib/zoho/client';
import { unstable_cache } from 'next/cache';

interface ZohoCategory {
  category_id: string;
  name: string;
  description?: string;
  is_inactive?: boolean;
}

interface ZohoCategoriesResponse {
  categories: ZohoCategory[];
}

// Cache categories for 1 hour
const getCategoriesCached = unstable_cache(
  async () => {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoCategoriesResponse>('/categories', {
        api: 'books',
      })
    );
    return data.categories || [];
  },
  ['mobile-categories'],
  {
    revalidate: 3600, // 1 hour
    tags: ['categories'],
  }
);

export async function GET() {
  try {
    const categories = await getCategoriesCached();

    // Filter out inactive categories and transform
    const activeCategories = categories
      .filter(cat => !cat.is_inactive)
      .map(cat => ({
        id: cat.category_id,
        name: cat.name,
        description: cat.description || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return mobileSuccess({
      categories: activeCategories,
    }, {
      page: 1,
      per_page: activeCategories.length,
      total_items: activeCategories.length,
      total_pages: 1,
      has_more: false,
    });

  } catch (error) {
    console.error('[Mobile Categories] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load categories',
      'فشل تحميل الفئات',
      500
    );
  }
}
