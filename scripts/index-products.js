// ============================================
// Product Indexing Script
// Indexes all products into Upstash Vector DB
// ============================================

require('dotenv').config({ path: '.env.local' });
const readline = require('readline');

async function indexProducts() {
  console.log('📦 TSH Product Indexing Tool\n');
  console.log('This will index all your products into Upstash Vector database.');
  console.log('⏱️  Estimated time: 5-10 minutes for ~1000 products\n');

  // Check environment variables
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  const secret = process.env.EMBED_SECRET || 'tsh-embed-2024';

  if (!url || !token) {
    console.error('❌ Missing environment variables:');
    if (!url) console.error('   - UPSTASH_VECTOR_REST_URL');
    if (!token) console.error('   - UPSTASH_VECTOR_REST_TOKEN');
    console.error('\nPlease run: npm run verify-upstash');
    process.exit(1);
  }

  // Check if dev server is running
  console.log('🔍 Checking if dev server is running...');
  try {
    const response = await fetch('http://localhost:3000/api/ai/embed?secret=' + secret);
    if (!response.ok) {
      throw new Error('Dev server not responding');
    }
    console.log('✅ Dev server is running\n');
  } catch (error) {
    console.error('❌ Dev server is not running!');
    console.error('\nPlease start the dev server first:');
    console.error('   npm run dev');
    console.error('\nThen run this script in a new terminal.');
    process.exit(1);
  }

  // Ask for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question('⚠️  Do you want to clear existing vectors first? (y/N): ', resolve);
  });

  const clear = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  rl.close();

  console.log('\n🚀 Starting indexing process...\n');

  try {
    const response = await fetch(`http://localhost:3000/api/ai/embed?secret=${secret}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'index-all',
        clear,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Indexing failed');
    }

    const result = await response.json();

    console.log('\n✅ Indexing complete!\n');
    console.log('Statistics:');
    console.log(`   📦 Total Products: ${result.stats.totalProducts}`);
    console.log(`   ✅ Indexed: ${result.stats.indexed}`);
    console.log(`   ❌ Failed: ${result.stats.failed}`);

    if (result.stats.failed > 0) {
      console.log('\n⚠️  Some products failed to index. Check logs for details.');
    }

    console.log('\n🎉 Your AI assistant is ready to use!');
    console.log('\nTest it:');
    console.log('   1. Open http://localhost:3000');
    console.log('   2. Click the gold floating button');
    console.log('   3. Try: "ابي محول سريع لايفون"');
  } catch (error) {
    console.error('\n❌ Indexing failed:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

// Run indexing
indexProducts().catch(console.error);
