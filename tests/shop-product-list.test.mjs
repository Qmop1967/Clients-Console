import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterAndSortShopProducts,
  hasProductImage,
  normalizeStockFilter,
  selectImageReadyNewArrivals,
} from '../src/lib/shop-product-list.ts';

const products = [
  {
    item_id: '11',
    name: 'Newest photographed item',
    sku: 'TSH-0011',
    rate: 11000,
    available_stock: 3,
    image_url: '/api/images/11',
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
    image_url: '/api/images/10',
  },
  {
    item_id: '13',
    name: 'Unavailable photographed item',
    sku: 'TSH-0013',
    rate: 13000,
    available_stock: 0,
    image_url: '/api/images/13',
  },
];

test('defaults missing and invalid stock parameters to in-stock', () => {
  assert.equal(normalizeStockFilter(null), 'in-stock');
  assert.equal(normalizeStockFilter('unexpected'), 'in-stock');
  assert.equal(normalizeStockFilter('all'), 'all');
  assert.equal(normalizeStockFilter('out-of-stock'), 'out-of-stock');
});

test('treats blank and branded placeholder URLs as missing images', () => {
  assert.equal(hasProductImage({ image_url: null }), false);
  assert.equal(hasProductImage({ image_url: '/images/product-placeholder.svg?v=1' }), false);
  assert.equal(hasProductImage({ image_url: '/api/images/11' }), true);
});

test('default mode excludes unavailable products', () => {
  const result = filterAndSortShopProducts(products, {
    query: '',
    sortBy: 'newest',
    stockFilter: 'in-stock',
  });

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
  const result = filterAndSortShopProducts(products, {
    query: '',
    sortBy: 'price-desc',
    stockFilter: 'in-stock',
  });

  assert.deepEqual(result.map((product) => product.item_id), ['11', '10', '12']);
});

test('search is applied together with the availability filter', () => {
  const result = filterAndSortShopProducts(products, {
    query: 'unavailable',
    sortBy: 'newest',
    stockFilter: 'in-stock',
  });

  assert.deepEqual(result, []);
});

test('new arrivals exclude products that are missing approved images', () => {
  const arrivals = selectImageReadyNewArrivals([
    {
      ...products[1],
      create_date: '2026-07-28 00:00:00',
    },
    {
      ...products[0],
      create_date: '2026-07-27 00:00:00',
    },
    {
      ...products[2],
      create_date: '2026-07-26 00:00:00',
    },
    {
      ...products[3],
      create_date: '2026-07-29 00:00:00',
    },
  ]);

  assert.deepEqual(
    arrivals.map((product) => product.item_id),
    ['11', '10'],
  );
});
