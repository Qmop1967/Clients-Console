/**
 * Zoho API barrel file - clean exports for all Zoho services
 */

// Client exports
export { getAccessToken, zohoFetch, rateLimitedFetch, CACHE_TAGS } from './client';

// Customer exports
export {
  getZohoCustomerByEmail,
  getZohoCustomer,
  getCustomerWithTag,
  createZohoCustomer,
  getCustomerBalance,
} from './customers';

// Product exports
export {
  getAllProducts,
  getProductsInStock,
  getProduct,
  getProductWithInventoryStock,
  getCategories,
  getProductsByCategory,
  searchProducts,
  getProductImageUrl,
  getAllProductsMetadata,
  getProductsMetadataSafe,
  getAllProductsComplete,
  getProductCount,
  getWarehouses,
  getWholesaleWarehouseId,
  fetchAccurateStockBatch,
  fetchAccurateStockBatchOptimized,
  getProductsWithPrices,
  getProductsWithConsumerPrices,
} from './products';

// Price list exports
export {
  PRICE_LIST_IDS,
  PRICE_LIST_INFO,
  getPriceLists,
  getPriceListBasic,
  getPriceListWithItems,
  getPriceList,
  getConsumerPriceList,
  getItemPriceFromList,
  getCustomerPriceList,
} from './price-lists';

// Order exports
export {
  getCustomerOrders,
  getOrder,
  getOrderPackages,
  getOrderShipments,
  getOrderWithDetails,
  getRecentOrders,
  getOrderStats,
  createSalesOrder,
  confirmSalesOrder,
  createInvoiceFromSalesOrder,
  confirmInvoice,
  ORDER_STATUS_MAP,
  getOrderSummaryStats,
  type OrderSummaryStats,
} from './orders';

// Invoice exports
export {
  getCustomerInvoices,
  getInvoice,
  getRecentInvoices,
  getOverdueInvoices,
  INVOICE_STATUS_MAP,
  getInvoiceSummaryStats,
  type InvoiceSummaryStats,
} from './invoices';

// Payment exports
export {
  getCustomerPayments,
  getPayment,
  getRecentPayments,
  getPaymentTotals,
} from './payments';

// Credit note exports
export {
  getCustomerCreditNotes,
  getCreditNote,
  getAvailableCreditBalance,
  CREDIT_NOTE_STATUS_MAP,
} from './credit-notes';

// Statement exports
export {
  getAccountStatement,
  getStatementSummary,
  type StatementTransaction,
  type AccountStatementData,
} from './statements';

// Stock cache exports
export {
  getStockCache,
  getCachedStock,
  getCachedStockBulk,
  syncWholesaleStock,
  quickSyncStock,
  isStockCacheStale,
  getStockCacheStatus,
  getUnifiedStock,
  getUnifiedStockBulk,
  syncStockFromBooks,
} from './stock-cache';
