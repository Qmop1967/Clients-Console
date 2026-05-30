// ============================================
// Odoo Client via API Gateway - No Direct Connection
// ============================================

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3010';
const API_KEY = process.env.API_KEY || 'tsh-client-2026-key';

async function gw(path: string, body: any): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Gateway call failed');
  return data.data;
}

export async function authenticate(): Promise<number> { return 1; } // Auth handled by gateway
export function getSessionId(): string | null { return null; }
export function resetSession(): void {}

export async function odooSearch(model: string, domain: unknown[] = [], options: { offset?: number; limit?: number; order?: string } = {}): Promise<number[]> {
  const records = await gw('/api/odoo/search_read', { model, domain, fields: ['id'], limit: options.limit, offset: options.offset, order: options.order });
  return (records || []).map((r: any) => r.id);
}

export async function odooRead<T = Record<string, unknown>>(model: string, ids: number[], fields: string[] = [], context?: Record<string, unknown>): Promise<T[]> {
  return gw('/api/odoo/call', { model, method: 'read', args: [ids], kwargs: context ? { fields, context } : { fields } });
}

export async function odooSearchRead<T = Record<string, unknown>>(model: string, domain: unknown[] = [], fields: string[] = [], options: { offset?: number; limit?: number; order?: string } = {}): Promise<T[]> {
  return gw('/api/odoo/search_read', { model, domain, fields, limit: options.limit, offset: options.offset, order: options.order });
}

export async function odooCount(model: string, domain: unknown[] = []): Promise<number> {
  return gw('/api/odoo/search_count', { model, domain });
}

export async function odooCreate(model: string, values: Record<string, unknown>): Promise<number> {
  return gw('/api/odoo/create', { model, values });
}

export async function odooWrite(model: string, ids: number[], values: Record<string, unknown>): Promise<boolean> {
  return gw('/api/odoo/write', { model, ids, values });
}

export async function odooUnlink(model: string, ids: number[]): Promise<boolean> {
  return gw('/api/odoo/call', { model, method: 'unlink', args: [ids] });
}

/**
 * Build URL for product image proxy.
 *
 * GATEWAY CONTRACT (since 2026-05-13 fix dd37e3b):
 *   /api/image/product/:id MUST receive product_product.id (pp_id), NOT product_template.id.
 *   Gateway internally resolves pp_id → template via product.product lookup.
 *
 * BAN-IMG-CLI-1: Never pass product_tmpl_id here. Doing so triggers ID collision
 *   (e.g. pp=2498 belongs to TP-Link Switch, but tmpl=2498 is Handbor Cleaning Kit).
 *
 * @param productId  product_product.id (pp_id) — the variant ID, not template ID
 * @param size       requested image size
 */
export function getOdooImageUrl(productId: number, size: '128x128' | '256x256' | '512x512' | '1920x1920' = '256x256', version?: number): string {
  // version = gateway-computed image_1920 attachment write_date (epoch s). Busts browser/edge
  // cache on set-main/unset-main. Static fallback only when no version supplied.
  const v = version ? String(version) : '6';
  return `/api/images/${productId}?size=${size}&v=${v}`;
}

/**
 * Batched image-version lookup via the GATEWAY (which reads ir.attachment; the client may not).
 * GET /api/products/image-versions?ids=... -> { versions: { variantId: epochSeconds } }.
 * version 0 / absent => no image_1920 => placeholder. Non-fatal on error (returns {}).
 */
export async function getImageVersions(productIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const ids = Array.from(new Set(productIds.filter((n) => Number.isInteger(n) && n > 0)));
  if (!ids.length) return out;
  try {
    const res = await fetch(`${GATEWAY_URL}/api/products/image-versions?ids=${ids.join(',')}`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
      cache: 'no-store',
    });
    const data = await res.json();
    if (data && data.success && data.versions) {
      for (const [k, v] of Object.entries(data.versions as Record<string, number>)) {
        if (v) out.set(parseInt(k, 10), v as number); // omit 0 => placeholder
      }
    }
  } catch (err) {
    console.error('[Odoo Client] getImageVersions failed (non-fatal):', err);
  }
  return out;
}

export function getOdooBaseUrl(): string { return GATEWAY_URL; }
