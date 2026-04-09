// ============================================
// Odoo Customers API - Server Only
// ============================================
// Replaces Odoo contacts API with Odoo res.partner
// Maintains same return types (Customer) for page compatibility
// ============================================

import { odooSearchRead, odooRead } from './client';
import type { OdooPartner } from './types';
import type { Customer } from '@/types';

// Fields to fetch from res.partner
const PARTNER_FIELDS = [
  'id', 'name', 'email', 'phone', 'mobile',
  'street', 'street2', 'city', 'state_id', 'country_id', 'zip',
  'company_name', 'customer_rank', 'credit', 'debit', 'credit_limit',
  'property_payment_term_id', 'property_product_pricelist',
  'active', 'x_currency',
  'create_date', 'write_date',
];

// IQD to USD conversion rate (for x_currency=USD customers)
const IQD_USD_RATE = 1500;

// ============================================
// Conversion: Odoo Partner → Customer
// ============================================

function odooPartnerToCustomer(p: OdooPartner): Customer {
  const currencyCode = (p.x_currency || 'IQD') as string;
  const pricelistId = Array.isArray(p.property_product_pricelist)
    ? String(p.property_product_pricelist[0])
    : undefined;
  const pricelistName = Array.isArray(p.property_product_pricelist)
    ? p.property_product_pricelist[1]
    : undefined;

  // Use credit as rough balance — getCustomerBalance() uses precise account.move.line
  const outstandingIQD = p.credit || 0;
  const outstanding = currencyCode === 'USD' ? outstandingIQD / IQD_USD_RATE : outstandingIQD;

  return {
    contact_id: String(p.id),
    contact_name: p.name,
    company_name: (p.company_name || undefined) as string | undefined,
    email: (p.email || '') as string,
    phone: (p.phone || undefined) as string | undefined,
    mobile: (p.mobile || undefined) as string | undefined,
    currency_code: currencyCode,
    currency_symbol: currencyCode === 'USD' ? '$' : 'IQD',
    outstanding_receivable_amount: outstanding,
    unused_credits_receivable_amount: 0, // Odoo doesn't have a direct equivalent
    status: p.active ? 'active' : 'inactive',
    payment_terms: 0,
    payment_terms_label: Array.isArray(p.property_payment_term_id)
      ? p.property_payment_term_id[1]
      : 'Immediate',
    price_list_id: pricelistId,
    price_list_name: pricelistName,
    pricebook_id: pricelistId,
    pricebook_name: pricelistName,
    billing_address: p.street ? {
      address: (p.street || '') as string,
      street2: (p.street2 || undefined) as string | undefined,
      city: (p.city || '') as string,
      state: Array.isArray(p.state_id) ? p.state_id[1] : '',
      zip: (p.zip || '') as string,
      country: Array.isArray(p.country_id) ? p.country_id[1] : '',
    } : undefined,
    created_time: p.create_date,
    last_modified_time: p.write_date,
  };
}

// ============================================
// Customer API
// ============================================

/**
 * Get customer by email address
 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  try {
    const partners = await odooSearchRead<OdooPartner>(
      'res.partner',
      [
        ['email', '=', email],
        ['customer_rank', '>', 0],
      ],
      PARTNER_FIELDS,
      { limit: 1 }
    );

    return partners.length > 0 ? odooPartnerToCustomer(partners[0]) : null;
  } catch (error) {
    console.error(`[Odoo Customers] Error fetching customer by email ${email}:`, error);
    return null;
  }
}

/**
 * Get customer by Odoo ID
 */
export async function getCustomerById(id: number | string): Promise<Customer | null> {
  try {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) return null;

    const partners = await odooRead<OdooPartner>('res.partner', [numId], PARTNER_FIELDS);
    if (!partners.length) return null;

    return odooPartnerToCustomer(partners[0]);
  } catch (error) {
    console.error(`[Odoo Customers] Error fetching customer ${id}:`, error);
    return null;
  }
}

/**
 * Get customer balance
 * credit field = Total Receivable (always in IQD)
 * For USD customers (x_currency=USD): credit ÷ 1500 = balance in USD
 */
export async function getCustomerBalance(id: number | string): Promise<{
  outstanding: number;
  unused_credits: number;
  currency_code: string;
} | null> {
  try {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) return null;

    // Get customer currency first
    const customer = await getCustomerById(numId);
    if (!customer) return null;

    const currencyCode = customer.currency_code || 'IQD';
    // Determine the receivable account: USD=194(1202), IQD=161(1201)
    const receivableAccountId = currencyCode === 'USD' ? 194 : 161;

    // Calculate PRECISE balance from unreconciled account.move.line via Gateway
    try {
      const gwUrl = process.env.API_GATEWAY_URL || process.env.GATEWAY_URL || 'http://127.0.0.1:3010';
      const gwKey = process.env.GATEWAY_API_KEY || process.env.API_KEY || '';
      const res = await fetch(`${gwUrl}/api/odoo/call`, {
        method: 'POST',
        headers: { 'x-api-key': gwKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'account.move.line',
          method: 'search_read',
          args: [[
            ['partner_id', '=', numId],
            ['account_id', '=', receivableAccountId],
            ['reconciled', '=', false],
            ['parent_state', '=', 'posted'],
          ]],
          kwargs: { fields: ['amount_residual_currency'], limit: 500 },
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const balance = data.data.reduce((sum: number, l: { amount_residual_currency: number }) => 
          sum + (l.amount_residual_currency || 0), 0);
        return {
          outstanding: Math.abs(balance),
          unused_credits: balance < 0 ? Math.abs(balance) : 0,
          currency_code: currencyCode,
        };
      }
    } catch (moveErr) {
      console.warn('[Odoo] Falling back to credit field for balance:', moveErr);
    }
    // Fallback
    return {
      outstanding: customer.outstanding_receivable_amount,
      unused_credits: 0,
      currency_code: currencyCode,
    };
  } catch (error) {
    console.error(`[Odoo Customers] Error fetching balance for ${id}:`, error);
    return null;
  }
}

/**
 * Search customers by name or phone
 */
export async function searchCustomers(
  query: string,
  limit = 10
): Promise<Customer[]> {
  try {
    const partners = await odooSearchRead<OdooPartner>(
      'res.partner',
      [
        ['customer_rank', '>', 0],
        '|', '|',
        ['name', 'ilike', query],
        ['phone', 'ilike', query],
        ['mobile', 'ilike', query],
      ],
      PARTNER_FIELDS,
      { limit, order: 'name ASC' }
    );

    return partners.map(odooPartnerToCustomer);
  } catch (error) {
    console.error(`[Odoo Customers] Error searching customers:`, error);
    return [];
  }
}

/**
 * Get customer by phone number (for login)
 * Searches both phone and mobile fields
 */
export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  try {
    // Normalize phone: strip spaces, dashes, and leading +964/00964
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const variants = [cleaned];
    // Add variants without country code
    if (cleaned.startsWith('+964')) variants.push('0' + cleaned.slice(4));
    if (cleaned.startsWith('00964')) variants.push('0' + cleaned.slice(5));
    if (cleaned.startsWith('0')) {
      variants.push('+964' + cleaned.slice(1));
      variants.push('00964' + cleaned.slice(1));
    }
    // Also try without leading zero
    if (cleaned.startsWith('0')) variants.push(cleaned.slice(1));

    // Also add variants with leading single-quote (Odoo stores some as '"+964...")
    const withQuote = variants.map(v => "'" + v);
    const allVariants = [...variants, ...withQuote];
    
    // Use last 10 digits for fuzzy ilike match as fallback
    const digits = cleaned.replace(/[^0-9]/g, '');
    const last10 = digits.slice(-10);

    const domain: unknown[] = [
      '&', ['customer_rank', '>', 0],
      '|', '|', '|',
      ['phone', 'in', allVariants],
      ['mobile', 'in', allVariants],
      ['phone', 'ilike', last10],
      ['mobile', 'ilike', last10],
    ];

    const partners = await odooSearchRead<OdooPartner>(
      'res.partner',
      domain,
      PARTNER_FIELDS,
      { limit: 1 }
    );

    return partners.length > 0 ? odooPartnerToCustomer(partners[0]) : null;
  } catch (error) {
    console.error(`[Odoo Customers] Error fetching customer by phone ${phone}:`, error);
    return null;
  }
}


// Convenience aliases
export const getCustomerFresh = getCustomerById;
export const getCustomer = getCustomerById;
