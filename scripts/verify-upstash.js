// ============================================
// Upstash Vector Database Connection Tester
// ============================================

require('dotenv').config({ path: '.env.local' });
const { Index } = require('@upstash/vector');

async function verifyUpstash() {
  console.log('🔍 Verifying Upstash Vector connection...\n');

  // Check environment variables
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (!url || !token) {
    console.error('❌ Missing environment variables:');
    if (!url) console.error('   - UPSTASH_VECTOR_REST_URL');
    if (!token) console.error('   - UPSTASH_VECTOR_REST_TOKEN');
    console.error('\nPlease add these to your .env.local file');
    process.exit(1);
  }

  console.log('✅ Environment variables found');
  console.log(`   URL: ${url.substring(0, 30)}...`);
  console.log(`   Token: ${token.substring(0, 10)}...${token.slice(-5)}\n`);

  try {
    // Initialize index
    const index = new Index({
      url,
      token,
    });

    console.log('📊 Fetching database info...');
    const info = await index.info();

    console.log('\n✅ Connection successful!\n');
    console.log('Database Stats:');
    console.log(`   📦 Total Vectors: ${info.vectorCount || 0}`);
    console.log(`   📏 Dimensions: ${info.dimension || 1536}`);
    console.log(`   📊 Similarity: ${info.similarityFunction || 'COSINE'}`);

    if (info.vectorCount === 0) {
      console.log('\n⚠️  Database is empty (no products indexed yet)');
      console.log('   Run: npm run index-products');
    } else {
      console.log('\n🎉 Database is ready to use!');
    }

    return true;
  } catch (error) {
    console.error('\n❌ Connection failed:');
    console.error(`   ${error.message}\n`);

    if (error.message.includes('401')) {
      console.error('💡 Common issues:');
      console.error('   - Check your token is correct (no spaces)');
      console.error('   - Make sure you copied the REST API credentials, not Console credentials');
    } else if (error.message.includes('404')) {
      console.error('💡 Common issues:');
      console.error('   - Check your URL is correct');
      console.error('   - Make sure the database exists in Upstash dashboard');
    }

    process.exit(1);
  }
}

// Run verification
verifyUpstash().catch(console.error);
