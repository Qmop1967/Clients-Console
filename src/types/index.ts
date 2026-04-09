// ============================================
// TSH Clients Console - Type Definitions
// ============================================

// Customer
export interface Customer {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  mobile?: string;
  currency_code: string;
  currency_symbol: string;
  outstanding_receivable_amount: number;
  unused_credits_receivable_amount: number;
  status: string;
  payment_terms: number;
  payment_terms_label: string;
  price_list_id?: string;
  price_list_name?: string;
  // API uses pricebook_id instead of price_list_id
  pricebook_id?: string;
  pricebook_name?: string;
  billing_address?: Address;
  shipping_address?: Address;
  created_time: string;
  last_modified_time: string;
}

export interface Address {
  attention?: string;
  address: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

// Product/Item
// Note: Fields are made optional to support various API responses
export interface Product {
  item_id: string;
  name: string;
  description?: string;
  sku: string;
  unit: string;
  status: string;
  rate: number;
  purchase_rate?: number;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  item_type?: string;
  product_type?: string;
  is_taxable?: boolean;
  is_returnable?: boolean;
  // Image fields
  image_name?: string;
  image_type?: string;
  image_document_id?: string;
  has_attachment?: boolean;
  image_url?: string; // Constructed URL
  category_id?: string;
  category_name?: string;
  brand?: string;
  manufacturer?: string;
  // Stock fields (optional as they may not be present in all contexts)
  stock_on_hand?: number;
  available_stock?: number;
  actual_available_stock?: number;
  committed_stock?: number;
  warehouse_name?: string;
  warehouse_id?: string;
  reorder_level?: number;
  created_time?: string;
  last_modified_time?: string;
  // Custom fields
  custom_fields?: Array<{
    customfield_id: string;
    label: string;
    value: string | number;
  }>;
  // Minimum quantity restriction (from custom field)
  minimum_quantity?: number;
}

// Price List
export interface PriceList {
  pricebook_id: string;
  name: string;
  description?: string;
  currency_code: string;
  currency_symbol: string;
  is_active: boolean;
  status?: string;
  round_off_to?: string;
  pricing_scheme?: string;
  pricebook_items?: ItemPrice[];
  item_prices?: ItemPrice[];
}

export interface ItemPrice {
  item_id: string;
  name: string;
  rate: number;
  discount?: number;
  discount_type?: string;
}

// Category/Catalog
export interface Category {
  category_id: string;
  name: string;
  description?: string;
  parent_category_id?: string;
  is_active: boolean;
}

// Sales Order
export interface SalesOrder {
  salesorder_id: string;
  salesorder_number: string;
  date: string;
  status: string;
  customer_id: string;
  customer_name: string;
  reference_number?: string;
  total: number;
  sub_total: number;
  tax_total: number;
  discount: number;
  discount_type?: string;
  shipping_charge: number;
  currency_code: string;
  currency_symbol: string;
  exchange_rate: number;
  delivery_date?: string;
  shipment_date?: string;
  notes?: string;
  terms?: string;
  line_items: LineItem[];
  packages?: ShipmentPackage[];
  shipments?: Shipment[];
  created_time: string;
  last_modified_time: string;
  // Receipt tracking custom fields
  cf_overall_receive_status?: 'pending' | 'partial' | 'completed';
  cf_receive_timeline?: string; // JSON array of receipt events
}

// Package (Carton)
export interface ShipmentPackage {
  package_id: string;
  package_number: string;
  salesorder_id: string;
  date: string;
  status: string;
  tracking_number?: string;
  carrier?: string;
  notes?: string;
  line_items: ShipmentPackageLineItem[];
  created_time: string;
  last_modified_time: string;
}

export interface ShipmentPackageLineItem {
  line_item_id: string;
  item_id: string;
  item_name: string;
  sku?: string;
  quantity: number;
}

// Shipment
export interface Shipment {
  shipment_id: string;
  shipment_number: string;
  salesorder_id: string;
  package_ids: string[];
  date: string;
  delivery_date?: string;
  carrier: string;
  tracking_number?: string;
  tracking_url?: string;
  shipping_charge?: number;
  notes?: string;
  status: string;
  delivered_date?: string;
  documents?: Document[];
  created_time: string;
  last_modified_time: string;
  // Handoff fields (from Odoo stock.picking)
  fulfillment_stage?: string;
  handoff_state?: string;
  handoff_date?: string;
  handoff_code?: string;
  package_count?: number;
  package_count_actual?: number;
  carrier_name?: string;
  receipt_number?: string;
  handoff_notes?: string;
}

// Document/Attachment
export interface Document {
  document_id: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  source?: string;
  created_time: string;
}

export interface LineItem {
  line_item_id: string;
  item_id: string;
  item_name?: string;  // Inventory API uses this
  name?: string;       // Books API uses this
  sku?: string;
  description?: string;
  rate: number;
  quantity: number;
  unit: string;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  item_total: number;
  discount?: number;
  discount_type?: string;
  // Receipt tracking custom fields
  cf_quantity_received?: number;
  cf_receive_status?: 'pending' | 'partial' | 'completed';
  cf_last_received_date?: string;
}

// Invoice
export interface Invoice {
  invoice_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  status: string;
  customer_id: string;
  customer_name: string;
  reference_number?: string;
  total: number;
  balance: number;
  sub_total: number;
  tax_total: number;
  discount: number;
  currency_code: string;
  currency_symbol: string;
  exchange_rate: number;
  payment_made: number;
  credits_applied: number;
  write_off_amount: number;
  notes?: string;
  terms?: string;
  invoice_url?: string;
  line_items: LineItem[];
  payments: PaymentInfo[];
  created_time: string;
  last_modified_time: string;
}

export interface PaymentInfo {
  payment_id: string;
  amount: number;
  date: string;
  payment_mode: string;
}

// Payment
export interface Payment {
  payment_id: string;
  payment_number: string;
  date: string;
  amount: number;
  unused_amount: number;
  customer_id: string;
  customer_name: string;
  payment_mode: string;
  reference_number?: string;
  description?: string;
  bank_charges?: number;
  currency_code: string;
  currency_symbol: string;
  exchange_rate: number;
  invoices: PaymentInvoice[];
  created_time: string;
  last_modified_time: string;
}

export interface PaymentInvoice {
  invoice_id: string;
  invoice_number: string;
  amount_applied: number;
  date: string;
}

// Credit Note
export interface CreditNote {
  creditnote_id: string;
  creditnote_number: string;
  date: string;
  status: string;
  customer_id: string;
  customer_name: string;
  reference_number?: string;
  total: number;
  balance: number;
  currency_code: string;
  currency_symbol: string;
  notes?: string;
  line_items: LineItem[];
  created_time: string;
  last_modified_time: string;
}

// Account Statement
export interface AccountStatement {
  customer: Customer;
  opening_balance: number;
  closing_balance: number;
  currency_code: string;
  currency_symbol: string;
  from_date: string;
  to_date: string;
  transactions: AccountTransaction[];
}

export interface AccountTransaction {
  transaction_id: string;
  transaction_type: 'invoice' | 'payment' | 'credit_note' | 'debit_note' | 'refund';
  transaction_number: string;
  date: string;
  debit: number;
  credit: number;
  balance: number;
  description?: string;
}

// App User (linked to Customer)
export interface AppUser {
  id: string;
  email: string;
  odoo_partner_id: string;
  name: string;
  company_name?: string;
  phone?: string;
  currency_code: string;
  price_list_id?: string;
  created_at: string;
  last_login?: string;
}

// Cart
export interface CartItem {
  item_id: string;
  name: string;
  sku: string;
  quantity: number;
  rate: number;
  image_url?: string | null;
  available_stock: number;
  unit: string;
  minimum_quantity?: number;
}

export interface Cart {
  items: CartItem[];
  currency_code: string;
  currency_symbol: string;
  sub_total: number;
  total: number;
}

// Support Ticket
export interface SupportTicket {
  id: string;
  customer_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender: 'customer' | 'support';
  message: string;
  created_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

// Dashboard Stats
export interface DashboardStats {
  outstanding_balance: number;
  unused_credits: number;
  total_orders: number;
  pending_orders: number;
  recent_orders: SalesOrder[];
  recent_invoices: Invoice[];
  currency_code: string;
  currency_symbol: string;
}

// Locale
export type Locale = 'en' | 'ar';

// Theme
export type Theme = 'light' | 'dark' | 'system';
