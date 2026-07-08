// ============================================
// Passkey (WebAuthn) credential store - Server Only
// ============================================
// Credentials live on res.partner.x_passkeys (Odoo text/JSON field), reached
// through the tsh-api gateway internal routes — never Odoo directly, never a
// browser. Mirrors mintActorToken's server→gateway call: API_GATEWAY_URL +
// x-api-key. Fail-closed: any gateway error throws, and the calling route
// translates that into a 503 rather than silently treating the user as having
// no passkeys.
// ============================================

export interface PasskeyRecord {
  id: string;         // credentialID (base64url)
  publicKey: string;  // COSE public key (base64url)
  counter: number;
  transports?: string[];
  deviceName?: string;
  createdAt: string;
  lastUsedAt?: string;
}

function gatewayUrl(): string {
  return process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
}

function apiKey(): string {
  return process.env.API_KEY || '';
}

/** Read all passkeys for a partner. Throws on gateway error (fail-closed). */
export async function getPartnerPasskeys(partnerId: number): Promise<PasskeyRecord[]> {
  const res = await fetch(`${gatewayUrl()}/api/internal/partners/${partnerId}/passkeys`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey() },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`passkey_store_read_failed:${res.status}`);
  }
  const data = await res.json();
  if (!data?.success || !Array.isArray(data?.data?.passkeys)) {
    throw new Error('passkey_store_bad_response');
  }
  return data.data.passkeys as PasskeyRecord[];
}

/** Full-replace a partner's passkeys. Throws on gateway error (fail-closed). */
export async function savePartnerPasskeys(partnerId: number, records: PasskeyRecord[]): Promise<void> {
  const res = await fetch(`${gatewayUrl()}/api/internal/partners/${partnerId}/passkeys`, {
    method: 'PUT',
    headers: { 'x-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ passkeys: records }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`passkey_store_write_failed:${res.status}`);
  }
  const data = await res.json();
  if (!data?.success) {
    throw new Error('passkey_store_write_bad_response');
  }
}
