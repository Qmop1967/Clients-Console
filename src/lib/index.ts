/**
 * Main lib barrel file
 * Re-exports all library modules for clean imports
 *
 * Usage:
 *   import { cn, formatCurrency, auth } from '@/lib';
 *   import { getProduct, getCustomerOrders } from '@/lib/zoho';
 */

// Utils exports
export * from './utils';

// Note: Auth and Zoho modules have their own barrel files
// Import from '@/lib/auth' or '@/lib/zoho' for those
