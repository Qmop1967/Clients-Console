// Batch Classification Script (ESM)
// Run with: node scripts/batch-classify-local.mjs

import 'dotenv/config';

const API_URL = 'https://staging.tsh.sale/api/products/classify';
const SECRET = 'tsh-classify-2024';

// Fetch all products from Zoho via the staging API
async function fetchProducts() {
  console.log('📦 Fetching products from Zoho...');

  // We'll need to get products from an internal API or direct Zoho call
  // For now, let's use a simple approach - fetch from the debug endpoint
  const orgId = process.env.ZOHO_ORGANIZATION_ID || '748369814';

  // Fetch token first
  const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
  }

  // Fetch all products from Zoho Books
  const products = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://www.zohoapis.com/books/v3/items?organization_id=${orgId}&page=${page}&per_page=200`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      }
    );

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      products.push(...data.items);
      page++;
      hasMore = data.page_context?.has_more_page || false;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Found ${products.length} products`);
  return products;
}

// Batch classify products
async function classifyBatch(products, batchNumber, totalBatches) {
  console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${products.length} products)...`);

  const response = await fetch(`${API_URL}?action=batch&secret=${SECRET}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: products.map(p => ({
        item_id: p.item_id,
        name: p.name,
        description: p.description,
        image_url: p.image_name ? `https://staging.tsh.sale/api/zoho/images/${p.item_id}` : undefined,
        category_id: p.category_id,
        category_name: p.category_name,
      })),
      batch_size: 5,
      delay_ms: 1500,
    }),
  });

  const data = await response.json();

  if (data.success) {
    console.log(`   ✅ Classified ${data.stats.classified}/${data.stats.total} in ${(data.stats.duration_ms / 1000).toFixed(1)}s`);
    return data.data;
  } else {
    console.log(`   ❌ Error: ${data.error}`);
    return [];
  }
}

async function main() {
  console.log('🚀 Starting batch classification...\n');

  // Fetch all products
  const allProducts = await fetchProducts();

  // Skip already classified (first 5 from our test)
  const alreadyClassifiedIds = new Set([
    '2646610000003193001',
    '2646610000066650802',
    '2646610000003193005',
    '2646610000003193008',
    '2646610000003193010',
  ]);

  const productsToClassify = allProducts.filter(p => !alreadyClassifiedIds.has(p.item_id));
  console.log(`\n📊 Products to classify: ${productsToClassify.length}`);

  // Split into batches of 50 products each (to avoid timeout)
  const BATCH_SIZE = 50;
  const batches = [];
  for (let i = 0; i < productsToClassify.length; i += BATCH_SIZE) {
    batches.push(productsToClassify.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Split into ${batches.length} batches of up to ${BATCH_SIZE} products each\n`);

  const startTime = Date.now();
  let totalClassified = 0;
  const allClassifications = [];

  // Process each batch with a delay between batches
  for (let i = 0; i < batches.length; i++) {
    const classifications = await classifyBatch(batches[i], i + 1, batches.length);
    allClassifications.push(...classifications);
    totalClassified += classifications.length;

    // 5 second delay between batches to avoid rate limiting
    if (i < batches.length - 1) {
      console.log('   ⏳ Waiting 5s before next batch...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n\n✅ Classification complete!\n');
  console.log('📈 Summary:');
  console.log(`   - Total products: ${allProducts.length}`);
  console.log(`   - Classified: ${totalClassified}`);
  console.log(`   - Duration: ${duration} minutes`);

  // Show category distribution
  const categoryCounts = new Map();
  for (const c of allClassifications) {
    const key = c.primary_category;
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  console.log('\n📊 Category Distribution:');
  for (const [category, count] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   - ${category}: ${count}`);
  }
}

main().catch(console.error);
