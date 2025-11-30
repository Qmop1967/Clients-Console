import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { cookies } from 'next/headers';
import { getCustomerBalance } from '@/lib/zoho/customers';

export async function GET() {
  try {
    // Check cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter(c =>
      c.name.includes('auth') || c.name.includes('session')
    );

    // Try to get session
    const session = await auth();

    // If no session, return debug info
    if (!session?.user) {
      return NextResponse.json({
        authenticated: false,
        authCookiesFound: authCookies.map(c => c.name),
        sessionRaw: session,
      });
    }

    // Get balance for comparison
    const zohoContactId = session.user.zohoContactId;
    let balance = null;
    if (zohoContactId) {
      balance = await getCustomerBalance(zohoContactId);
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        zohoContactId: session.user.zohoContactId,
        priceListId: session.user.priceListId,
        currencyCode: session.user.currencyCode,
      },
      balance,
      authCookiesFound: authCookies.map(c => c.name),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
