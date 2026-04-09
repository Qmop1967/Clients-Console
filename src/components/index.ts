/**
 * Main Components barrel file
 * Re-exports all component categories for clean imports
 *
 * Usage:
 *   import { Button, Card } from '@/components/ui';
 *   import { Header, MainLayout } from '@/components/layout';
 *   import { ProductCard, ProductFilters } from '@/components/products';
 */

// Re-export all UI components
export * from './ui';

// Re-export layout components
export * from './layout';

// Re-export feature components
export * from './dashboard';
export * from './orders';
export * from './invoices';
export * from './products';
export * from './statements';

// Re-export providers
export * from './providers';
