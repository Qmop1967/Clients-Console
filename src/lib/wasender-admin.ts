/**
 * WASender admin operations using Personal Access Token (PAT).
 * Used by /admin/whatsapp/* endpoints for self-service session re-linking.
 *
 * Required env vars:
 *   - WASENDER_PAT: Personal Access Token (generate from WASender profile settings)
 *   - WASENDER_SESSION_ID: numeric session ID (visible in dashboard URL or via /api/whatsapp-sessions)
 *   - WASENDER_ADMIN_KEY: secret key required in x-admin-key header to call admin endpoints
 *
 * Without PAT configured, admin endpoints return 503 — the rest of the app keeps working normally.
 */

const WASENDER_BASE = 'https://www.wasenderapi.com';

export interface AdminConfigStatus {
  configured: boolean;
  missing: string[];
}

export function checkAdminConfig(): AdminConfigStatus {
  const missing: string[] = [];
  if (!process.env.WASENDER_PAT) missing.push('WASENDER_PAT');
  if (!process.env.WASENDER_SESSION_ID) missing.push('WASENDER_SESSION_ID');
  if (!process.env.WASENDER_ADMIN_KEY) missing.push('WASENDER_ADMIN_KEY');
  return { configured: missing.length === 0, missing };
}

export function isAdminAuthorized(headerKey: string | null): boolean {
  const expected = process.env.WASENDER_ADMIN_KEY;
  if (!expected) return false;
  if (!headerKey) return false;
  // Constant-time comparison
  if (headerKey.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < headerKey.length; i++) {
    result |= headerKey.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

async function patFetch(path: string, init?: RequestInit) {
  const pat = process.env.WASENDER_PAT;
  if (!pat) throw new Error('WASENDER_PAT not configured');

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(`${WASENDER_BASE}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * List all WhatsApp sessions under the account (account-scoped, requires PAT).
 */
export async function listSessions() {
  const res = await patFetch('/api/whatsapp-sessions');
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Initialize/connect a session — returns QR code if scanning is needed.
 */
export async function connectSession(sessionId: string) {
  const res = await patFetch(`/api/whatsapp-sessions/${sessionId}/connect`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Get the QR code for a session that's already initialized via connect.
 */
export async function getSessionQrCode(sessionId: string) {
  const res = await patFetch(`/api/whatsapp-sessions/${sessionId}/qrcode`);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Get session status from PAT-authenticated endpoint.
 */
export async function getSessionStatus(sessionId: string) {
  const res = await patFetch(`/api/whatsapp-sessions/${sessionId}/status`);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Disconnect a session.
 */
export async function disconnectSession(sessionId: string) {
  const res = await patFetch(`/api/whatsapp-sessions/${sessionId}/disconnect`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
