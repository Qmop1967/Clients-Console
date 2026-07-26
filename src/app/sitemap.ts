import type { MetadataRoute } from 'next';
import { getPublicProductsWithPricesCached } from '@/lib/odoo/products';
import { getConsumerPricelistId } from '@/lib/odoo/pricelists';

const BASE = 'https://tsh.sale';
const PAGES = [
  '',
  '/about',
  '/catalog',
  '/shop',
  '/wholesale',
  '/wholesale/ac-adapters',
  '/contact-us',
  '/privacy',
  '/terms',
];
const LOCALES = ['ar', 'en'];

/** Public storefront only. Partner-portal routes are intentionally excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages = LOCALES.flatMap((locale) =>
    PAGES.map((page) => ({
      url: `${BASE}/${locale}${page}`,
      lastModified: now,
      changeFrequency: page === '' || page === '/shop' ? ('weekly' as const) : ('monthly' as const),
      priority: page === '' ? 1 : page === '/shop' ? 0.9 : 0.7,
    }))
  );

  try {
    const consumerPricelistId = await getConsumerPricelistId();
    const { products } = await getPublicProductsWithPricesCached(consumerPricelistId, 'en_US');
    const productPages = LOCALES.flatMap((locale) =>
      products.map((product) => ({
        url: `${BASE}/${locale}/shop/${product.item_id}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }))
    );
    return [...staticPages, ...productPages];
  } catch (error) {
    console.error('[Sitemap] Public products unavailable:', error);
    return staticPages;
  }
}
