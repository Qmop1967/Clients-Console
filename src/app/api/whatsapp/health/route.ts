import { NextResponse } from 'next/server';
import { getProviderHealth } from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/health
 * Read-only snapshot of WhatsApp provider circuit breaker states.
 * Used by watchdog + admin dashboard to detect provider outages early.
 */
export async function GET() {
  try {
    const providers = getProviderHealth();

    // Aggregate status: healthy if at least one provider CLOSED
    const anyHealthy = providers.some((p) => p.state === 'CLOSED' && p.lastSuccessAt);
    const allOpen = providers.every((p) => p.state === 'OPEN');

    const status = allOpen ? 'CRITICAL' : anyHealthy ? 'OK' : 'DEGRADED';

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      providers,
    });
  } catch (err) {
    console.error('[WhatsApp Health] Error:', err);
    return NextResponse.json(
      { status: 'ERROR', error: String(err) },
      { status: 500 }
    );
  }
}
