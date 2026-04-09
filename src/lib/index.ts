/**
 * Main lib barrel file
 * Re-exports all library modules for clean imports
 *
 * Usage:
 *   import { cn, formatCurrency, auth } from '@/lib';
 *   import { getProduct, getCustomerOrders } from '@/lib/odoo';
 */

// Utils exports
export * from './utils';

// Note: Auth modules have their own barrel files
// Import from '@/lib/auth' for auth
