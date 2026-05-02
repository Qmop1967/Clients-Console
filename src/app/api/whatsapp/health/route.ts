import { NextResponse } from 'next/server';
import { getProviderHealth, getProbeStatus } from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/health
 * Read-only snapshot of WhatsApp provider circuit breaker states + probe status.
 * Used by watchdog + admin dashboard + UI auto-adaptation to detect provider outages early.
 */
export async function GET() {
  try {
    const providers = getProviderHealth();
    const probe = getProbeStatus();

    // Aggregate status: healthy if at least one provider CLOSED with recent success
    const anyHealthy = providers.some((p) => p.state === 'CLOSED' && p.lastSuccessAt);
    const allOpen = providers.every((p) => p.state === 'OPEN');

    const status = allOpen ? 'CRITICAL' : anyHealthy ? 'OK' : 'DEGRADED';

    // For UI: simple boolean flags
    const ui = {
      whatsapp_available: providers.find((p) => p.provider === 'wasender')?.state === 'CLOSED'
        || providers.find((p) => p.provider === 'openclaw')?.state === 'CLOSED',
      whatsapp_provider_state: providers.find((p) => p.provider === 'wasender')?.state || 'UNKNOWN',
      reason: providers.find((p) => p.provider === 'wasender')?.lastError || null,
    };

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      ui,
      probe,
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
