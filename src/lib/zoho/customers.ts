// ============================================
// Zoho Customers API - Server Only
// ============================================

import { unstable_cache } from 'next/cache';
import { zohoFetch, CACHE_TAGS, rateLimitedFetch } from './client';
import type { ZohoCustomer } from '@/types';

interface ZohoCustomersResponse {
  contacts: ZohoCustomer[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    total_pages: number;
  };
}

interface ZohoCustomerResponse {
  contact: ZohoCustomer;
}

// Get customer by email
export async function getZohoCustomerByEmail(
  email: string
): Promise<ZohoCustomer | null> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoCustomersResponse>('/contacts', {
        params: { email },
      })
    );

    return data.contacts?.[0] || null;
  } catch (error) {
    console.error('Error fetching customer by email:', error);
    return null;
  }
}

// Get customer by ID (cached - 5 minutes)
// Use this for general data display where slight staleness is acceptable
export const getZohoCustomer = unstable_cache(
  async (contactId: string): Promise<ZohoCustomer | null> => {
    try {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoCustomerResponse>(`/contacts/${contactId}`)
      );

      return data.contact || null;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  },
  ['zoho-customer'],
  {
    revalidate: 300, // 5 minutes
    tags: ['customer'],
  }
);

// Get customer by ID (UNCACHED - real-time)
// Use this for session/auth where we need the latest pricebook_id
export async function getZohoCustomerFresh(contactId: string): Promise<ZohoCustomer | null> {
  try {
    const data = await rateLimitedFetch(() =>
      zohoFetch<ZohoCustomerResponse>(`/contacts/${contactId}`)
    );

    return data.contact || null;
  } catch (error) {
    console.error('[getZohoCustomerFresh] Error:', error);
    return null;
  }
}

// Get customer with specific tag for revalidation
export async function getCustomerWithTag(
  contactId: string
): Promise<ZohoCustomer | null> {
  const getCachedCustomer = unstable_cache(
    async () => {
      const data = await rateLimitedFetch(() =>
        zohoFetch<ZohoCustomerResponse>(`/contacts/${contactId}`)
      );
      return data.contact || null;
    },
    [`customer-${contactId}`],
    {
      revalidate: 300,
      tags: [CACHE_TAGS.CUSTOMER(contactId)],
    }
  );

  return getCachedCustomer();
}

// Create new customer in Zoho
export async function createZohoCustomer(data: {
  email: string;
  name?: string;
  phone?: string;
  company_name?: string;
}): Promise<ZohoCustomer | null> {
  try {
    const response = await rateLimitedFetch(() =>
      zohoFetch<ZohoCustomerResponse>('/contacts', {
        method: 'POST',
        body: {
          contact_name: data.name || data.email.split('@')[0],
          email: data.email,
          phone: data.phone,
          company_name: data.company_name,
          contact_type: 'customer',
          currency_id: process.env.ZOHO_DEFAULT_CURRENCY_ID || '',
        },
      })
    );

    return response.contact;
  } catch (error) {
    console.error('Error creating customer:', error);
    return null;
  }
}

// Get customer's outstanding balance
export async function getCustomerBalance(
  contactId: string
): Promise<{
  outstanding: number;
  unused_credits: number;
  currency_code: string;
} | null> {
  try {
    if (!contactId) {
      console.warn('[getCustomerBalance] No contactId provided');
      return null;
    }

    const customer = await getCustomerWithTag(contactId);
    if (!customer) {
      console.warn(`[getCustomerBalance] Customer not found for contactId: ${contactId}`);
      return null;
    }

    return {
      outstanding: customer.outstanding_receivable_amount ?? 0,
      unused_credits: customer.unused_credits_receivable_amount ?? 0,
      currency_code: customer.currency_code || 'IQD',
    };
  } catch (error) {
    console.error(`[getCustomerBalance] Error for contactId ${contactId}:`, error);
    return null;
  }
}
