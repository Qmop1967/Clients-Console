# TSH Clients Console - Change History

## v2.0.0 (2025-12-28)
- **Webhook 404 Error Handling**: Fixed CRITICAL errors for expected 404 responses
  - Invoice webhooks now handle "Resource does not exist" gracefully
  - Returns `{ success: true, notFound: true }` instead of throwing errors
- **Stock Sync Resilience**: Improved quickSyncStock error handling
  - 404 errors for deleted items handled gracefully
  - Network errors retry with backoff
- **Build Error Prevention**: Added guidelines for route groups, 404 handling, logging levels

## v1.9.0
- **CRITICAL FIX: Order Warehouse Fulfillment**: Fixed stock being deducted from wrong location
  - Set `location_id` on LINE ITEMS (not `warehouse_id` at order level)
  - Added MAIN_TSH_BUSINESS_ID and MAIN_WAREHOUSE_ID constants

## v1.8.0
- **Two-Branch Deployment Workflow**: preview → staging, main → production
- GitHub Actions CI/CD pipeline

## v1.7.0
- **Enhanced Arabic RTL Experience**: Larger stat numbers, improved typography

## v1.6.0
- **Luxury Frontend Redesign**: Cormorant Garamond + Plus Jakarta Sans typography
- Gold accent color system, premium shadows
- Component library upgrade (Button, Card, Badge, Input variants)

## v1.5.0
- **CRITICAL FIX**: Migrated from Zoho Inventory to Zoho Books API
- Rate limit error handling with user-friendly messages

## v1.4.0
- Fixed stock display to show "Available for Sale" instead of "Stock on Hand"
- Changed from `warehouses` array to `locations` array

## v1.3.0
- **CRITICAL FIX**: Implemented Upstash Redis for Zoho OAuth token caching
- Multi-tier caching: Memory → Upstash Redis → Vercel KV → Zoho refresh

## v1.2.0
- Added TSH Price Lists reference with all 9 pricebooks
- Consumer price list for public visitors

## v1.1.0
- Replaced all mock data with real Zoho API data
- Added pagination support
- TSH = Tech Spider Hand (not Tech Supplies Hub)
