#!/bin/bash
# Batch Classification Script using curl
# Requires: jq

API_URL="https://staging.tsh.sale/api/products/classify"
SECRET="tsh-classify-2024"

# Test batch of 5 products
TEST_PRODUCTS='[
  {"item_id":"2646610000003193001","name":"TP-Link 8-Port Gigabit Desktop Switch TL-SG108","description":"8-port gigabit switch"},
  {"item_id":"2646610000066650802","name":"( 2 Female To 1 Male ) RCA Adapter","description":"Audio adapter"},
  {"item_id":"2646610000003193005","name":"Hikvision DS-2CD1023G0E-I 2MP IP Camera","description":"2MP POE IP camera"},
  {"item_id":"2646610000003193008","name":"APC Back-UPS 650VA BX650LI-MS","description":"650VA UPS system"},
  {"item_id":"2646610000003193010","name":"Cat6 UTP Network Cable 305m Box","description":"Ethernet cable box"}
]'

echo "🚀 Testing batch classification with 5 products..."
echo ""

RESULT=$(curl -s -X POST "${API_URL}?action=batch&secret=${SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"products\": ${TEST_PRODUCTS}, \"batch_size\": 3, \"delay_ms\": 1500}")

echo "$RESULT" | jq '.'

echo ""
echo "✅ Batch test complete!"
