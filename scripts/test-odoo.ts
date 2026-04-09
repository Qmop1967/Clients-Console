#!/usr/bin/env npx tsx
// ============================================
// Odoo Connection Test Script
// ============================================
// Usage: npx tsx scripts/test-odoo.ts
// Tests: authentication, products, customers, stock
// ============================================

const ODOO_URL = process.env.ODOO_URL || 'http://209.38.249.218:8069';
const ODOO_DB = process.env.ODOO_DB || 'tsh_main';
const ODOO_USER = process.env.ODOO_USER || 'admin';
const ODOO_PASS = process.env.ODOO_PASS || '';

let rpcId = 0;

async function jsonRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'call',
      params: { service, method, args },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message);
  return data.result;
}

async function main() {
  console.log('🔌 Testing Odoo connection...');
  console.log(`   URL: ${ODOO_URL}`);
  console.log(`   DB:  ${ODOO_DB}`);
  console.log(`   User: ${ODOO_USER}\n`);

  // 1. Authenticate
  console.log('1️⃣  Authenticating...');
  const uid = await jsonRpc<number>('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_PASS, {}]);
  if (!uid) throw new Error('Authentication failed!');
  console.log(`   ✅ Authenticated as uid=${uid}\n`);

  // Helper
  const execute = <T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
    jsonRpc<T>('object', 'execute_kw', [ODOO_DB, uid, ODOO_PASS, model, method, args, kwargs]);

  // 2. Fetch 5 products
  console.log('2️⃣  Fetching 5 products...');
  const products = await execute<any[]>('product.product', 'search_read', [
    [['sale_ok', '=', true], ['active', '=', true]],
  ], {
    fields: ['id', 'name', 'default_code', 'list_price', 'qty_available', 'categ_id', 'product_tmpl_id'],
    limit: 5,
    order: 'name ASC',
  });
  for (const p of products) {
    console.log(`   📦 [${p.id}] ${p.name} | SKU: ${p.default_code || 'N/A'} | Price: ${p.list_price} | Stock: ${p.qty_available} | Template: ${p.product_tmpl_id?.[0]}`);
  }
  console.log(`   ✅ Got ${products.length} products\n`);

  // 3. Count total products
  const totalProducts = await execute<number>('product.product', 'search_count', [
    [['sale_ok', '=', true], ['active', '=', true], ['type', '!=', 'service']],
  ]);
  console.log(`3️⃣  Total saleable products: ${totalProducts}\n`);

  // 4. Fetch categories
  console.log('4️⃣  Fetching categories...');
  const categories = await execute<any[]>('product.category', 'search_read', [[]], {
    fields: ['id', 'name', 'complete_name', 'product_count'],
    order: 'name ASC',
    limit: 10,
  });
  for (const c of categories) {
    console.log(`   📂 [${c.id}] ${c.complete_name} (${c.product_count} products)`);
  }
  console.log(`   ✅ Got ${categories.length} categories\n`);

  // 5. Fetch 3 customers
  console.log('5️⃣  Fetching 3 customers...');
  const customers = await execute<any[]>('res.partner', 'search_read', [
    [['customer_rank', '>', 0]],
  ], {
    fields: ['id', 'name', 'email', 'credit', 'property_product_pricelist', 'x_currency'],
    limit: 3,
    order: 'name ASC',
  });
  for (const c of customers) {
    console.log(`   👤 [${c.id}] ${c.name} | Email: ${c.email || 'N/A'} | Credit: ${c.credit} IQD | Currency: ${c.x_currency || 'IQD'} | Pricelist: ${c.property_product_pricelist?.[1] || 'N/A'}`);
  }
  console.log(`   ✅ Got ${customers.length} customers\n`);

  // 6. Fetch pricelists
  console.log('6️⃣  Fetching pricelists...');
  const pricelists = await execute<any[]>('product.pricelist', 'search_read', [
    [['active', '=', true]],
  ], {
    fields: ['id', 'name', 'currency_id'],
    order: 'name ASC',
  });
  for (const pl of pricelists) {
    console.log(`   💰 [${pl.id}] ${pl.name} (${pl.currency_id?.[1]})`);
  }
  console.log(`   ✅ Got ${pricelists.length} pricelists\n`);

  // 7. Stock check (first product)
  if (products.length > 0) {
    const pid = products[0].id;
    console.log(`7️⃣  Checking stock.quant for product ${pid}...`);
    const quants = await execute<any[]>('stock.quant', 'search_read', [
      [['product_id', '=', pid], ['location_id.usage', '=', 'internal']],
    ], {
      fields: ['product_id', 'location_id', 'quantity', 'reserved_quantity'],
    });
    for (const q of quants) {
      console.log(`   📊 Location: ${q.location_id?.[1]} | Qty: ${q.quantity} | Reserved: ${q.reserved_quantity} | Available: ${q.quantity - q.reserved_quantity}`);
    }
    console.log(`   ✅ Got ${quants.length} quants\n`);
  }

  console.log('🎉 All tests passed!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
