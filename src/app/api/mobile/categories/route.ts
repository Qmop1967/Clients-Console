// ============================================
// Mobile Categories API
// GET /api/mobile/categories
// ============================================

import { NextRequest } from 'next/server';
import { mobileSuccess, mobileError } from '@/lib/auth/mobile-middleware';
import { getCategories } from '@/lib/odoo/products';

export async function GET(request: NextRequest) {
  try {
    const categories = await getCategories();

    return mobileSuccess({
      categories: categories.map(c => ({
        id: c.category_id,
        name: c.name,
        description: c.description || null,
        parent_id: c.parent_category_id || null,
        is_active: c.is_active,
      })),
    });
  } catch (error) {
    console.error('[Mobile Categories] Error:', error);
    return mobileError('SERVER_ERROR', 'Failed to load categories', 'فشل تحميل التصنيفات', 500);
  }
}
