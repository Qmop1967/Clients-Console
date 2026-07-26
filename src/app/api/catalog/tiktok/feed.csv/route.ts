import { NextResponse } from 'next/server';
import { getPublicProductsWithPricesCached } from '@/lib/odoo/products';
import { getConsumerPricelistId } from '@/lib/odoo/pricelists';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_BASE = 'https://tsh.sale';

function csvCell(value: unknown): string {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function cleanTitle(value: unknown): string {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

function deriveBrand(title: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\bTP[\s-]?Link\b/i, 'TP-Link'],
    [/\bPIX[\s-]?LINK\b/i, 'PIX-LINK'],
    [/\bT-WOLF\b/i, 'T-WOLF'],
    [/\bTenda\b/i, 'Tenda'],
    [/\bSaeapu\b/i, 'Saeapu'],
    [/\bPrinco\b/i, 'Princo'],
    [/\bSafe\s*Scope\b/i, 'Safe Scope'],
    [/\bHandboss\b/i, 'Handboss'],
    [/\bPowerPluse\b/i, 'PowerPluse'],
    [/\bPowerPlus\b/i, 'PowerPlus'],
    [/\b(?:SuperLink|Super Link)\b/i, 'SuperLink'],
    [/\bCyber\s*Link\b/i, 'Cyber Link'],
    [/\bOrixoon\b/i, 'Orixoon'],
    [/\bTronix\b/i, 'Tronix'],
  ];
  return rules.find(([pattern]) => pattern.test(title))?.[1] || 'Unbranded';
}

export async function GET() {
  try {
    const consumerPricelistId = await getConsumerPricelistId();
    const { products, currency } = await getPublicProductsWithPricesCached(
      consumerPricelistId,
      'en_US'
    );

    if (currency !== 'IQD') {
      console.error('[TikTok Catalog] Consumer pricelist currency mismatch:', currency);
      return NextResponse.json({ error: 'catalog_unavailable' }, { status: 503 });
    }

    const missingPrice = products.filter((product) => !product.in_price_list).length;
    const missingImage = products.filter((product) => !product.public_image_id).length;
    const eligible = products.filter((product) =>
      product.in_price_list
      && product.display_price > 0
      && product.public_image_id
      && product.public_image_version
    );

    const header = [
      'sku_id', 'title', 'description', 'availability', 'condition',
      'price', 'link', 'image_link', 'brand', 'product_type',
    ].join(',');
    const rows = [header];

    for (const product of eligible) {
      const title = cleanTitle(product.name);
      // Odoo descriptions are not yet consistently reviewed. Reuse the verified
      // product name rather than export potentially mismatched marketing copy.
      const description = title;
      const price = `${Math.round(product.display_price)} IQD`;
      const availability = (product.available_stock || 0) > 0 ? 'in stock' : 'out of stock';
      const image = `${SITE_BASE}/api/catalog/tiktok/image/${product.public_image_id}-${product.public_image_version}.jpeg`;
      rows.push([
        csvCell(product.sku),
        csvCell(title),
        csvCell(description || title),
        csvCell(availability),
        csvCell('new'),
        csvCell(price),
        csvCell(`${SITE_BASE}/ar/shop/${product.item_id}`),
        csvCell(image),
        csvCell(product.brand || deriveBrand(title)),
        csvCell(product.category_name || 'Electronics'),
      ].join(','));
    }

    const response = new NextResponse(`${rows.join('\n')}\n`, { status: 200 });
    response.headers.set('Content-Type', 'text/csv; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=300');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-TSH-Products-Total', String(products.length));
    response.headers.set('X-TSH-Products-Eligible', String(eligible.length));
    response.headers.set('X-TSH-Products-Missing-Price', String(missingPrice));
    response.headers.set('X-TSH-Products-Missing-Image', String(missingImage));
    return response;
  } catch (error) {
    console.error('[TikTok Catalog] Feed build failed:', error);
    return NextResponse.json({ error: 'catalog_unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
