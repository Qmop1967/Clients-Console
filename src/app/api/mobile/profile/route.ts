// ============================================
// Mobile Profile API
// GET /api/mobile/profile
// ============================================

import { NextRequest } from 'next/server';
import {
  requireMobileAuth,
  isAuthError,
  mobileSuccess,
  mobileError,
} from '@/lib/auth/mobile-middleware';
import { getZohoCustomerFresh } from '@/lib/zoho/customers';
import { PRICE_LIST_INFO } from '@/lib/zoho/price-lists';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireMobileAuth(request);
    if (isAuthError(authResult)) {
      return authResult;
    }

    const auth = authResult;
    const user = auth.user!;

    if (!user.zohoContactId) {
      return mobileError(
        'NO_CUSTOMER',
        'Your account is not linked to a customer record.',
        'حسابك غير مرتبط بسجل عميل.',
        400
      );
    }

    // Fetch fresh customer data from Zoho
    const customer = await getZohoCustomerFresh(user.zohoContactId);

    if (!customer) {
      return mobileError(
        'NOT_FOUND',
        'Customer profile not found',
        'لم يتم العثور على ملف العميل',
        404
      );
    }

    // Get price list info
    const priceListId = customer.pricebook_id || customer.price_list_id || '';
    const priceListInfo = PRICE_LIST_INFO[priceListId as keyof typeof PRICE_LIST_INFO];

    return mobileSuccess({
      profile: {
        id: customer.contact_id,
        name: customer.contact_name,
        email: customer.email,
        phone: customer.phone || null,
        mobile: customer.mobile || null,
        company_name: customer.company_name || null,
        // Financial info
        currency: customer.currency_code || 'IQD',
        price_list: priceListInfo?.name || 'Unknown',
        price_list_ar: priceListInfo?.nameAr || 'غير معروف',
        payment_terms: customer.payment_terms || null,
        payment_terms_label: customer.payment_terms_label || null,
        // Balance
        outstanding: customer.outstanding_receivable_amount || 0,
        unused_credits: customer.unused_credits_receivable_amount || 0,
        // Addresses
        billing_address: customer.billing_address || null,
        shipping_address: customer.shipping_address || null,
        // Status
        status: customer.status || 'active',
        created_time: customer.created_time || null,
      },
    });

  } catch (error) {
    console.error('[Mobile Profile] Error:', error);

    return mobileError(
      'SERVER_ERROR',
      'Failed to load profile',
      'فشل تحميل الملف الشخصي',
      500
    );
  }
}
