#!/bin/bash
# Legacy diagnostic: verify the live Odoo stock source and mobile quantity data.
# Stock is read directly from Odoo; this script does not mutate or force a sync.

set -euo pipefail

STAGING_URL="https://www.tsh.sale"
PROD_URL="https://www.tsh.sale"

echo "🔄 Checking live stock and minimum quantities..."
echo ""

# Function to run sync
run_sync() {
  local url=$1
  local env_name=$2

  echo "📊 Syncing ${env_name}..."
  echo "URL: ${url}"

  response=$(curl -fsS "${url}/api/sync/stock")

  if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
    echo "✅ ${env_name} stock source is healthy!"
    echo "$response" | jq '{success, source, itemCount, message}'
  else
    echo "❌ ${env_name} sync failed!"
    echo "$response" | jq -r '.error // "Unknown error"'
    return 1
  fi

  echo ""
}

# Check if rate limit has reset
echo "🔍 Checking if rate limit has reset..."
status=$(curl -fsS "${STAGING_URL}/api/sync/stock")

if echo "$status" | grep -q "429"; then
  echo "⏳ Rate limit still active. Please wait and try again later."
  echo "   Zoho daily rate limit (2,500 calls) typically resets at midnight."
  exit 1
fi

echo "✅ Rate limit has reset! Starting full sync..."
echo ""

# Run full sync on staging
run_sync "$STAGING_URL" "STAGING"

echo "🎉 Sync complete! Testing minimum quantity..."
echo ""

# Test the result
echo "📋 Testing BNC RG59 product..."
test_result=$(curl -s "${STAGING_URL}/api/mobile/products?search=BNC+RG59" | jq '.data.products[0] | {name, minimum_quantity}')
echo "$test_result"

min_qty=$(echo "$test_result" | jq -r '.minimum_quantity')
if [ "$min_qty" = "100" ]; then
  echo ""
  echo "✅ SUCCESS! Minimum quantity is now showing correctly!"
  echo ""
  echo "🚀 Ready to deploy to production. Run:"
  echo "   git checkout main && git merge preview && git push origin main && git checkout preview"
else
  echo ""
  echo "⚠️  Minimum quantity is: $min_qty (expected: 100)"
  echo "   Cache may need time to propagate. Wait 30s and retest."
fi
