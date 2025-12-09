// ============================================
// Debug Endpoint for Raw Customer Data Comparison
// ============================================
// Compares Zoho Books API vs Zoho Inventory API
// to find the correct pricebook_id field
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { zohoFetch, getAccessToken } from '@/lib/zoho/client';

const DEBUG_SECRET = process.env.DEBUG_SECRET || 'tsh-debug-2024';

interface ZohoContactResponse {
  contact: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');
  const contactId = searchParams.get('contactId');
  const email = searchParams.get('email');

  // Verify secret
  if (secret !== DEBUG_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!contactId && !email) {
    return NextResponse.json({
      error: 'contactId or email required',
      usage: '/api/debug/customer-raw?secret=xxx&contactId=xxx OR &email=xxx'
    }, { status: 400 });
  }

  try {
    const token = await getAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID || '748369814';

    let resolvedContactId = contactId;

    // If email provided, lookup contact ID first
    if (!resolvedContactId && email) {
      const booksSearchResponse = await fetch(
        `https://www.zohoapis.com/books/v3/contacts?organization_id=${orgId}&email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      const booksSearchData = await booksSearchResponse.json();
      resolvedContactId = booksSearchData.contacts?.[0]?.contact_id;

      if (!resolvedContactId) {
        return NextResponse.json({
          error: 'Contact not found by email',
          email,
          booksSearchResponse: booksSearchData
        }, { status: 404 });
      }
    }

    // Fetch from BOTH Zoho Books AND Zoho Inventory APIs in parallel
    const [booksResponse, inventoryResponse] = await Promise.all([
      fetch(
        `https://www.zohoapis.com/books/v3/contacts/${resolvedContactId}?organization_id=${orgId}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      ),
      fetch(
        `https://www.zohoapis.com/inventory/v1/contacts/${resolvedContactId}?organization_id=${orgId}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      ),
    ]);

    const booksData = booksResponse.ok ? await booksResponse.json() : { error: `Books API failed: ${booksResponse.status}` };
    const inventoryData = inventoryResponse.ok ? await inventoryResponse.json() : { error: `Inventory API failed: ${inventoryResponse.status}` };

    const booksContact = booksData.contact || {};
    const inventoryContact = inventoryData.contact || {};

    // Extract all pricebook-related fields from both APIs
    const comparison = {
      contact_id: resolvedContactId,
      contact_name: booksContact.contact_name || inventoryContact.contact_name,
      email: booksContact.email || inventoryContact.email,

      // Books API fields
      books: {
        pricebook_id: booksContact.pricebook_id,
        pricebook_name: booksContact.pricebook_name,
        price_list_id: booksContact.price_list_id,
        price_list_name: booksContact.price_list_name,
        currency_code: booksContact.currency_code,
        currency_id: booksContact.currency_id,
        // Check for custom fields
        cf_price_list: booksContact.cf_price_list,
        cf_pricebook: booksContact.cf_pricebook,
        // All custom fields
        custom_fields: booksContact.custom_fields,
      },

      // Inventory API fields
      inventory: {
        pricebook_id: inventoryContact.pricebook_id,
        pricebook_name: inventoryContact.pricebook_name,
        price_list_id: inventoryContact.price_list_id,
        price_list_name: inventoryContact.price_list_name,
        currency_code: inventoryContact.currency_code,
        currency_id: inventoryContact.currency_id,
        // Check for custom fields
        cf_price_list: inventoryContact.cf_price_list,
        cf_pricebook: inventoryContact.cf_pricebook,
        // All custom fields
        custom_fields: inventoryContact.custom_fields,
      },

      // Quick comparison
      match: {
        pricebook_id_match: booksContact.pricebook_id === inventoryContact.pricebook_id,
        books_pricebook_id: booksContact.pricebook_id || 'NOT_SET',
        inventory_pricebook_id: inventoryContact.pricebook_id || 'NOT_SET',
      },
    };

    // Reference price list IDs for quick lookup
    const priceListReference = {
      'Wholesale A IQD': '2646610000113417534',
      'Wholesale A USD': '2646610000004152175',
      'Wholesale B IQD': '2646610000113426003',
      'Wholesale B USD': '2646610000004453961',
      'Consumer': '2646610000049149103',
    };

    // Identify which price list each API is returning
    const identifyPriceList = (id: string) => {
      for (const [name, refId] of Object.entries(priceListReference)) {
        if (refId === id) return name;
      }
      return 'UNKNOWN';
    };

    return NextResponse.json({
      success: true,
      comparison,
      analysis: {
        books_returns: identifyPriceList(booksContact.pricebook_id),
        inventory_returns: identifyPriceList(inventoryContact.pricebook_id),
        apis_match: booksContact.pricebook_id === inventoryContact.pricebook_id,
        recommendation: booksContact.pricebook_id !== inventoryContact.pricebook_id
          ? 'APIs return DIFFERENT values - need to determine which is correct'
          : 'Both APIs return same value',
      },
      priceListReference,
      // Include raw responses for full inspection
      raw: {
        books: booksData,
        inventory: inventoryData,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      error: errorMsg,
    }, { status: 500 });
  }
}
