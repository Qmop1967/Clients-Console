import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregatePurchaseHistory,
  classifyPurchaseAvailability,
} from '../src/lib/odoo/purchase-history-aggregate.ts';

const relation = (id, label) => [id, label];

test('aggregates invoices, discounts, and credit-note returns by product variant', () => {
  const moves = [
    {
      id: 10,
      name: 'INV/10',
      move_type: 'out_invoice',
      invoice_date: '2026-01-10',
      currency_id: relation(1, 'IQD'),
      invoice_line_ids: [101, 102],
    },
    {
      id: 11,
      name: 'INV/11',
      move_type: 'out_invoice',
      invoice_date: '2026-03-04',
      currency_id: relation(1, 'IQD'),
      invoice_line_ids: [103],
    },
    {
      id: 12,
      name: 'RINV/12',
      move_type: 'out_refund',
      invoice_date: '2026-03-09',
      currency_id: relation(1, 'IQD'),
      invoice_line_ids: [104],
    },
  ];

  const lines = [
    {
      id: 101,
      move_id: relation(10, 'INV/10'),
      product_id: relation(501, '[TSH-0501] Adapter'),
      name: '[TSH-0501] Adapter',
      quantity: 2,
      price_unit: 10_000,
      price_subtotal: 18_000,
      product_uom_id: relation(1, 'Units'),
      display_type: false,
    },
    {
      id: 102,
      move_id: relation(10, 'INV/10'),
      product_id: relation(501, '[TSH-0501] Adapter'),
      name: '[TSH-0501] Adapter',
      quantity: 1,
      price_unit: 10_000,
      price_subtotal: 9_000,
      product_uom_id: relation(1, 'Units'),
      display_type: false,
    },
    {
      id: 103,
      move_id: relation(11, 'INV/11'),
      product_id: relation(501, '[TSH-0501] Adapter'),
      name: '[TSH-0501] Adapter',
      quantity: 5,
      price_unit: 11_000,
      price_subtotal: 55_000,
      product_uom_id: relation(1, 'Units'),
      display_type: false,
    },
    {
      id: 104,
      move_id: relation(12, 'RINV/12'),
      product_id: relation(501, '[TSH-0501] Adapter'),
      name: '[TSH-0501] Adapter',
      quantity: 2,
      price_unit: 11_000,
      price_subtotal: 22_000,
      product_uom_id: relation(1, 'Units'),
      display_type: false,
    },
  ];

  const result = aggregatePurchaseHistory(moves, lines);
  assert.equal(result.totalInvoices, 2);
  assert.equal(result.lastPurchaseDate, '2026-03-04');
  assert.equal(result.products.length, 1);

  const product = result.products[0];
  assert.equal(product.productId, '501');
  assert.equal(product.historicalSku, 'TSH-0501');
  assert.equal(product.purchaseCount, 2);
  assert.equal(product.purchasedQuantity, 8);
  assert.equal(product.returnedQuantity, 2);
  assert.equal(product.netQuantity, 6);
  assert.equal(product.lastQuantity, 5);
  assert.equal(product.lastUnitPrice, 11_000);
  assert.equal(product.lastInvoiceNumber, 'INV/11');
  assert.deepEqual(new Set(product.invoiceNumbers), new Set(['INV/10', 'INV/11']));
});

test('keeps fully returned products in history and ignores non-product lines', () => {
  const moves = [
    {
      id: 20,
      name: 'INV/20',
      move_type: 'out_invoice',
      invoice_date: '2026-04-01',
      currency_id: relation(2, 'USD'),
      invoice_line_ids: [201, 202],
    },
    {
      id: 21,
      name: 'RINV/21',
      move_type: 'out_refund',
      invoice_date: '2026-04-05',
      currency_id: relation(2, 'USD'),
      invoice_line_ids: [203],
    },
  ];

  const lines = [
    {
      id: 201,
      move_id: relation(20, 'INV/20'),
      product_id: relation(601, '[TSH-0601] SSD'),
      name: '[TSH-0601] SSD',
      quantity: 4,
      price_unit: 20,
      price_subtotal: 80,
      product_uom_id: relation(1, 'Units'),
      display_type: false,
    },
    {
      id: 202,
      move_id: relation(20, 'INV/20'),
      product_id: false,
      name: 'Section',
      quantity: 1,
      price_unit: 0,
      price_subtotal: 0,
      product_uom_id: false,
      display_type: 'line_section',
    },
    {
      id: 203,
      move_id: relation(21, 'RINV/21'),
      product_id: relation(601, '[TSH-0601] SSD'),
      name: '[TSH-0601] SSD',
      quantity: 4,
      price_unit: 20,
      price_subtotal: 80,
      product_uom_id: relation(1, 'Units'),
      display_type: false,
    },
  ];

  const result = aggregatePurchaseHistory(moves, lines);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].netQuantity, 0);
  assert.equal(result.products[0].lastCurrencyCode, 'USD');
});

test('does not create a purchased product from an orphan credit note', () => {
  const moves = [
    {
      id: 30,
      name: 'RINV/30',
      move_type: 'out_refund',
      invoice_date: '2026-05-01',
      currency_id: relation(1, 'IQD'),
      invoice_line_ids: [301],
    },
  ];
  const lines = [
    {
      id: 301,
      move_id: relation(30, 'RINV/30'),
      product_id: relation(701, '[TSH-0701] Cable'),
      name: '[TSH-0701] Cable',
      quantity: 1,
      price_unit: 1_000,
      price_subtotal: 1_000,
      product_uom_id: relation(1, 'Units'),
      display_type: false,
    },
  ];

  const result = aggregatePurchaseHistory(moves, lines);
  assert.equal(result.products.length, 0);
  assert.equal(result.totalInvoices, 0);
});

test('availability summary categories are mutually exclusive and exhaustive', () => {
  const products = [
    { status: 'active', is_current_product: true, available_stock: 4, inPriceList: true, rate: 12 },
    { status: 'active', is_current_product: true, available_stock: 4, inPriceList: true, rate: 0 },
    { status: 'active', is_current_product: true, available_stock: 0, inPriceList: true, rate: 12 },
    { status: 'active', is_current_product: true, available_stock: 4, inPriceList: false, rate: 0 },
    { status: 'inactive', is_current_product: true, available_stock: 4, inPriceList: true, rate: 12 },
    { status: 'archived', is_current_product: false, available_stock: 0, inPriceList: false, rate: 0 },
  ];

  const counts = { available: 0, unavailable: 0, discontinued: 0 };
  for (const product of products) counts[classifyPurchaseAvailability(product)] += 1;

  assert.deepEqual(counts, { available: 1, unavailable: 3, discontinued: 2 });
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), products.length);
});
