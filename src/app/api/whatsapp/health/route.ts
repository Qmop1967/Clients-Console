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

    // For UI: determine whatsapp availability based on probe + circuit state
    // Probe is authoritative source — it actively checks WASender every 60s.
    // If probe says NOT connected, WhatsApp is unavailable regardless of circuit state
    // (circuit may not have opened yet because failures haven't reached threshold).
    const wasenderProvider = providers.find((p) => p.provider === 'wasender');
    const probeKnowsWasenderConnected =
      probe.lastProbeStatus === 'connected' && probe.lastProbeAt !== null;

    // WhatsApp available if EITHER:
    //   1. Probe confirmed wasender is connected recently, OR
    //   2. Wasender circuit is CLOSED with a recent success (used recently and worked)
    const whatsapp_available =
      probeKnowsWasenderConnected ||
      (wasenderProvider?.state === 'CLOSED' && !!wasenderProvider?.lastSuccessAt);

    const ui = {
      whatsapp_available,
      whatsapp_provider_state: wasenderProvider?.state || 'UNKNOWN',
      probe_status: probe.lastProbeStatus,
      reason: wasenderProvider?.lastError || null,
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
