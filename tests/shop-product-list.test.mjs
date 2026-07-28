import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterAndSortShopProducts,
  hasProductImage,
  MIN_NEW_ARRIVALS,
  normalizeStockFilter,
  selectImageReadyNewArrivals,
} from '../src/lib/shop-product-list.ts';

// Fixed clock: the rail now has a 45-day window, so a wall-clock test would
// start failing on its own 45 days after it was written.
const NOW = Date.parse('2026-07-28T12:00:00Z');

const products = [
  {
    item_id: '11',
    name: 'Newest photographed item',
    sku: 'TSH-0011',
    rate: 11000,
    available_stock: 3,
    image_url: '/api/images/11?size=256x256&v=123',
  },
  {
    item_id: '12',
    name: 'Newest item but no image',
    sku: 'TSH-0012',
    rate: 12000,
    available_stock: 8,
    image_url: '/images/product-placeholder.svg',
  },
  {
    item_id: '10',
    name: 'Older photographed item',
    sku: 'TSH-0010',
    rate: 10000,
    available_stock: 5,
    image_url: '/api/images/10?size=256x256&v=99',
  },
  {
    item_id: '13',
    name: 'Unavailable photographed item',
    sku: 'TSH-0013',
    rate: 13000,
    available_stock: 0,
    image_url: '/api/images/13?size=256x256&v=5',
  },
];

test('defaults missing and invalid stock parameters to in-stock', () => {
  assert.equal(normalizeStockFilter(null), 'in-stock');
  assert.equal(normalizeStockFilter('unexpected'), 'in-stock');
  assert.equal(normalizeStockFilter('all'), 'all');
  assert.equal(normalizeStockFilter('out-of-stock'), 'out-of-stock');
});

test('treats blank, branded and gateway placeholder URLs as missing images', () => {
  assert.equal(hasProductImage({ image_url: null }), false);
  assert.equal(hasProductImage({ image_url: '   ' }), false);
  assert.equal(hasProductImage({ image_url: '/images/product-placeholder.svg?v=1' }), false);
  // Gateway placeholder — looks like a real image URL, so the suffix check alone
  // used to classify it as photographed and it stopped sinking to the last pages.
  assert.equal(hasProductImage({ image_url: '/api/images/11?ph=1&size=256x256' }), false);
  assert.equal(hasProductImage({ image_url: '/api/images/11?size=256x256&ph=1' }), false);
  assert.equal(hasProductImage({ image_url: '/api/images/11?size=256x256&v=6&e=2' }), true);
  assert.equal(hasProductImage({ image_url: 'https://media.tsh.sale/media/products/1/a.webp' }), true);
});

test('default mode excludes unavailable products but KEEPS missing-image products', () => {
  const result = filterAndSortShopProducts(products, {
    query: '',
    sortBy: 'newest',
    stockFilter: 'in-stock',
  });

  // 12 has no photo, so it sorts last — it is never removed from the catalog.
  assert.deepEqual(result.map((product) => product.item_id), ['11', '10', '12']);
  assert.equal(result.some((product) => product.available_stock <= 0), false);
});

test('all-products mode includes unavailable products', () => {
  const result = filterAndSortShopProducts(products, {
    query: '',
    sortBy: 'newest',
    stockFilter: 'all',
  });

  assert.deepEqual(result.map((product) => product.item_id), ['13', '11', '10', '12']);
});

test('out-of-stock mode returns only unavailable products', () => {
  const result = filterAndSortShopProducts(products, {
    query: '',
    sortBy: 'newest',
    stockFilter: 'out-of-stock',
  });

  assert.deepEqual(result.map((product) => product.item_id), ['13']);
});

test('missing-image products stay last for every user-selected sort', () => {
  for (const sortBy of ['newest', 'price-desc', 'price-asc', 'name-asc', 'name-desc', 'stock-desc']) {
    const result = filterAndSortShopProducts(products, {
      query: '',
      sortBy,
      stockFilter: 'in-stock',
    });
    assert.equal(
      result[result.length - 1].item_id,
      '12',
      `expected the missing-image product last for sort "${sortBy}"`
    );
  }
});

test('gateway placeholders also sink to the end', () => {
  const withGatewayPlaceholder = [
    { ...products[0], item_id: '20', image_url: '/api/images/20?ph=1&size=256x256' },
    products[2],
  ];
  const result = filterAndSortShopProducts(withGatewayPlaceholder, {
    query: '',
    sortBy: 'newest',
    stockFilter: 'in-stock',
  });

  assert.deepEqual(result.map((product) => product.item_id), ['10', '20']);
});

test('search matches the canonical name even when the card shows a translation', () => {
  const arabicCatalog = [
    { ...products[0], item_id: '11', name: 'سماعة العاب', alt_name: 'Headphone Gaming V6S' },
    { ...products[2], item_id: '10', name: 'كيبل شبكة', alt_name: 'Network Cable' },
  ];
  const result = filterAndSortShopProducts(arabicCatalog, {
    query: 'headphone',
    sortBy: 'newest',
    stockFilter: 'in-stock',
  });

  assert.deepEqual(result.map((product) => product.item_id), ['11']);
});

test('search is applied together with the availability filter', () => {
  const result = filterAndSortShopProducts(products, {
    query: 'unavailable',
    sortBy: 'newest',
    stockFilter: 'in-stock',
  });

  assert.deepEqual(result, []);
});

test('newest sort follows create_date, not the Odoo id', () => {
  const dated = [
    { ...products[2], item_id: '10', create_date: '2026-07-27 00:00:00' },
    { ...products[0], item_id: '11', create_date: '2026-07-20 00:00:00' },
  ];
  const result = filterAndSortShopProducts(dated, {
    query: '',
    sortBy: 'newest',
    stockFilter: 'in-stock',
  });

  // id 11 > id 10, but product 10 was created later — "Newest" must agree with the
  // "New" badge, which is driven by create_date.
  assert.deepEqual(result.map((product) => product.item_id), ['10', '11']);
});

test('new arrivals exclude products that are missing approved images', () => {
  const arrivals = selectImageReadyNewArrivals([
    { ...products[1], create_date: '2026-07-28 00:00:00' },
    { ...products[0], create_date: '2026-07-27 00:00:00' },
    { ...products[2], create_date: '2026-07-26 00:00:00' },
    { ...products[3], create_date: '2026-07-29 00:00:00' },
  ], 12, NOW);

  assert.deepEqual(arrivals.map((product) => product.item_id), ['11', '10']);
});

test('new arrivals only include products inside the 45-day window', () => {
  const arrivals = selectImageReadyNewArrivals([
    { ...products[0], item_id: '11', create_date: '2026-07-20 00:00:00' }, // 8 days
    { ...products[2], item_id: '10', create_date: '2026-01-05 00:00:00' }, // ~6 months
  ], 12, NOW);

  // The rail used to be "the 12 newest in-stock photographed products", which is
  // exactly what the grid's default sort already puts on page 1 — it re-showed
  // the same twelve cards 200px lower. Only genuinely new products qualify now.
  assert.deepEqual(arrivals.map((product) => product.item_id), ['11']);
});

test('the rail threshold is high enough to be worth a row', () => {
  assert.ok(MIN_NEW_ARRIVALS >= 4);
});
