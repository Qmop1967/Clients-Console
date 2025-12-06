// Debug endpoint for customer data testing
// Protected by DEBUG_API_SECRET
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { zohoFetch } from '@/lib/zoho/client';
import { validateDebugAuth } from '@/lib/auth/debug-auth';

export async function GET(request: NextRequest) {
  // Require authentication
  const authError = validateDebugAuth(request);
  if (authError) return authError;

  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const zohoContactId = session.user.zohoContactId;

    if (!zohoContactId) {
      return NextResponse.json({
        error: 'No Zoho contact ID',
        session: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          zohoContactId: session.user.zohoContactId,
          priceListId: session.user.priceListId,
          currencyCode: session.user.currencyCode,
        }
      });
    }

    // Fetch customer, orders, and invoices in parallel
    const [customerData, ordersData, invoicesData] = await Promise.all([
      zohoFetch<{ contact: Record<string, unknown> }>(`/contacts/${zohoContactId}`),
      zohoFetch<{ salesorders: Array<Record<string, unknown>>; page_context: Record<string, unknown> }>('/salesorders', {
        params: { customer_id: zohoContactId, per_page: 5 }
      }).catch(e => ({ salesorders: [], page_context: { total: 0 }, error: e.message })),
      zohoFetch<{ invoices: Array<Record<string, unknown>>; page_context: Record<string, unknown> }>('/invoices', {
        params: { customer_id: zohoContactId, per_page: 5 }
      }).catch(e => ({ invoices: [], page_context: { total: 0 }, error: e.message })),
    ]);

    return NextResponse.json({
      success: true,
      session: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        zohoContactId: session.user.zohoContactId,
        priceListId: session.user.priceListId,
        currencyCode: session.user.currencyCode,
      },
      zohoCustomer: {
        contact_name: customerData.contact?.contact_name,
        company_name: customerData.contact?.company_name,
        email: customerData.contact?.email,
        currency_code: customerData.contact?.currency_code,
        outstanding_receivable_amount: customerData.contact?.outstanding_receivable_amount,
        unused_credits_receivable_amount: customerData.contact?.unused_credits_receivable_amount,
        // Price list fields (Books uses pricebook_id, Inventory uses price_list_id)
        pricebook_id: customerData.contact?.pricebook_id,
        pricebook_name: customerData.contact?.pricebook_name,
        price_list_id: customerData.contact?.price_list_id,
        price_list_name: customerData.contact?.price_list_name,
      },
      ordersInfo: {
        totalFromApi: ordersData.page_context?.total,
        ordersCount: ordersData.salesorders?.length || 0,
        recentOrders: ordersData.salesorders?.map((o: Record<string, unknown>) => ({
          salesorder_number: o.salesorder_number,
          status: o.status,
          total: o.total,
          date: o.date,
        })) || [],
        error: (ordersData as Record<string, unknown>).error,
      },
      invoicesInfo: {
        totalFromApi: invoicesData.page_context?.total,
        invoicesCount: invoicesData.invoices?.length || 0,
        recentInvoices: invoicesData.invoices?.map((i: Record<string, unknown>) => ({
          invoice_number: i.invoice_number,
          status: i.status,
          total: i.total,
          balance: i.balance,
          date: i.date,
        })) || [],
        error: (invoicesData as Record<string, unknown>).error,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
