// ============================================
// Odoo TypeScript Interfaces
// ============================================
// Type definitions for all Odoo models used in TSH Clients Console
// These map to Odoo's ORM models via JSON-RPC API
// ============================================

export interface OdooProduct {
  id: number;
  name: string;
  default_code: string | false; // SKU
  barcode: string | false;
  list_price: number;
  standard_price: number;
  type: string; // 'consu' | 'service' | 'product'
  categ_id: [number, string] | false; // [id, name]
  product_tmpl_id: [number, string]; // [id, name]
  uom_id: [number, string]; // [id, name]
  active: boolean;
  sale_ok: boolean;
  purchase_ok: boolean;
  qty_available: number;
  virtual_available: number;
  free_qty: number;
  description?: string | false;
  description_sale?: string | false;
  image_1920?: string | false; // base64 (large, avoid fetching)
  image_256?: string | false; // base64 (may be empty after import)
  weight?: number;
  volume?: number;
  // Custom fields (TSH-specific)
  x_minimum_quantity?: number;
  x_brand?: string | false;
}

export interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  street: string | false;
  street2: string | false;
  city: string | false;
  state_id: [number, string] | false;
  country_id: [number, string] | false;
  zip: string | false;
  company_name: string | false;
  customer_rank: number;
  supplier_rank: number;
  credit: number; // Total Receivable (always IQD)
  debit: number;
  credit_limit: number;
  property_payment_term_id: [number, string] | false;
  property_product_pricelist: [number, string] | false;
  active: boolean;
  // Custom fields (TSH-specific)
  x_currency?: string | false; // 'USD' | 'IQD'
  create_date: string;
  write_date: string;
}

export interface OdooSaleOrder {
  id: number;
  name: string; // e.g. 'S00001'
  date_order: string;
  state: 'draft' | 'sent' | 'sale' | 'done' | 'cancel';
  partner_id: [number, string];
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  currency_id: [number, string];
  pricelist_id: [number, string];
  note: string | false;
  order_line: number[]; // IDs of sale.order.line
  invoice_ids: number[];
  delivery_status: string | false;
  create_date: string;
  write_date: string;
}

export interface OdooSaleOrderLine {
  id: number;
  order_id: [number, string];
  product_id: [number, string];
  name: string; // description
  product_uom_qty: number;
  price_unit: number;
  discount: number;
  price_subtotal: number;
  price_total: number;
  tax_id: [number, string][];
  product_uom: [number, string];
}

export interface OdooInvoice {
  id: number;
  name: string; // e.g. 'INV/2024/0001'
  move_type: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund' | 'entry';
  state: 'draft' | 'posted' | 'cancel';
  partner_id: [number, string];
  invoice_date: string | false;
  invoice_date_due: string | false;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  amount_residual: number; // remaining to pay
  currency_id: [number, string];
  payment_state: 'not_paid' | 'in_payment' | 'paid' | 'partial' | 'reversed';
  invoice_line_ids: number[];
  ref: string | false;
  narration: string | false;
  create_date: string;
  write_date: string;
}

export interface OdooPayment {
  id: number;
  name: string;
  payment_type: 'inbound' | 'outbound';
  partner_type: 'customer' | 'supplier';
  partner_id: [number, string];
  amount: number;
  currency_id: [number, string];
  date: string;
  state: 'draft' | 'posted' | 'sent' | 'reconciled' | 'cancelled';
  ref: string | false;
  journal_id: [number, string];
  payment_method_id: [number, string];
  create_date: string;
  write_date: string;
}

export interface OdooPricelist {
  id: number;
  name: string;
  currency_id: [number, string];
  active: boolean;
  item_ids: number[]; // IDs of product.pricelist.item
  // TSH custom
  x_legacy_pricebook_id?: string | false;
}

export interface OdooPricelistItem {
  id: number;
  pricelist_id: [number, string];
  product_tmpl_id: [number, string] | false;
  product_id: [number, string] | false;
  categ_id: [number, string] | false;
  applied_on: '3_global' | '2_product_category' | '1_product' | '0_product_variant';
  compute_price: 'fixed' | 'percentage' | 'formula';
  fixed_price: number;
  percent_price: number;
  min_quantity: number;
  date_start: string | false;
  date_end: string | false;
}

export interface OdooCategory {
  id: number;
  name: string;
  complete_name: string; // full path e.g. "All / Electronics / Phones"
  parent_id: [number, string] | false;
  child_id: number[];
  product_count: number;
}

export interface OdooStockQuant {
  id: number;
  product_id: [number, string];
  location_id: [number, string];
  lot_id: [number, string] | false;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number; // computed: quantity - reserved_quantity
  warehouse_id: [number, string] | false;
}
