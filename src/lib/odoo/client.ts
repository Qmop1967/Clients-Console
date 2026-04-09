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

export async function odooRead<T = Record<string, unknown>>(model: string, ids: number[], fields: string[] = []): Promise<T[]> {
  return gw('/api/odoo/call', { model, method: 'read', args: [ids], kwargs: { fields } });
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

export function getOdooImageUrl(productTemplateId: number, size: '128x128' | '256x256' | '512x512' | '1920x1920' = '256x256'): string {
  return `/api/images/${productTemplateId}?size=${size}&v=4`;
}

export function getOdooBaseUrl(): string { return GATEWAY_URL; }
