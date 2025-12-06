// Batch Classification Script
// Run with: npx ts-node scripts/batch-classify.ts

import { getAllProductsComplete } from '../src/lib/zoho/products';
import { classifyProducts } from '../src/lib/ai/classifier';

async function main() {
  console.log('🚀 Starting batch classification...\n');

  // Get all products
  console.log('📦 Fetching all products from Zoho...');
  const products = await getAllProductsComplete();
  console.log(`✅ Found ${products.length} products\n`);

  // Prepare products for classification
  const productsToClassify = products.map((p) => ({
    item_id: p.item_id,
    name: p.name,
    description: p.description,
    image_url: p.image_name ? `https://staging.tsh.sale/api/zoho/images/${p.item_id}` : undefined,
    category_id: p.category_id,
    category_name: p.category_name,
  }));

  console.log(`🤖 Starting AI classification for ${productsToClassify.length} products...\n`);
  console.log('⏳ This may take several minutes. Processing in batches of 5 with 2s delay...\n');

  const startTime = Date.now();
  let lastProgress = 0;

  // Classify in batches
  const classifications = await classifyProducts(productsToClassify, {
    batchSize: 5,
    delayMs: 2000,
    onProgress: (completed, total) => {
      if (completed - lastProgress >= 10 || completed === total) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const percent = ((completed / total) * 100).toFixed(1);
        console.log(`📊 Progress: ${completed}/${total} (${percent}%) - ${elapsed}s elapsed`);
        lastProgress = completed;
      }
    },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n✅ Classification complete!\n');
  console.log('📈 Summary:');
  console.log(`   - Total products: ${products.length}`);
  console.log(`   - Classified: ${classifications.length}`);
  console.log(`   - Duration: ${duration}s`);

  // Show category distribution
  const categoryCounts = new Map<string, number>();
  for (const c of classifications) {
    const key = c.primary_category;
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  console.log('\n📊 Category Distribution:');
  for (const [category, count] of Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   - ${category}: ${count}`);
  }

  // Show confidence distribution
  const highConfidence = classifications.filter((c) => c.confidence >= 80).length;
  const medConfidence = classifications.filter((c) => c.confidence >= 50 && c.confidence < 80).length;
  const lowConfidence = classifications.filter((c) => c.confidence < 50).length;

  console.log('\n🎯 Confidence Distribution:');
  console.log(`   - High (80-100%): ${highConfidence}`);
  console.log(`   - Medium (50-79%): ${medConfidence}`);
  console.log(`   - Low (<50%): ${lowConfidence}`);
}

main().catch(console.error);
