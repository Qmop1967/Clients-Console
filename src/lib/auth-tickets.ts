// ============================================
// Server-vouched auth tickets + recovery tokens (HMAC-signed, stateless)
// ============================================
// SECURITY 2026-07-02. Closes the hole where the phone/email Credentials
// providers minted a NextAuth session from a phone number alone (OTP was
// only checked client-side, so POSTing /api/auth/callback/phone directly
// forged a session for any known customer phone).
//
// WHY STATELESS HMAC (not Redis): this app's only configured Redis is a dummy
// Upstash endpoint (dummy.upstash.io), and there is no local Redis client in
// the bundle. A store-backed ticket would throw at runtime and fail-closed,
// breaking ALL logins. HMAC signing needs no store: a ticket is unforgeable
// without NEXTAUTH_SECRET, which is exactly what the exploit lacked. Zero new
// deps, no new availability coupling.
//
// Model:
//  - AUTH TICKET: short-lived (180s) signed proof that authentication actually
//    completed (OTP verified / Firebase SMS / valid recovery token). authorize()
//    verifies the signature + expiry and trusts the identity it carries — not
//    the client-supplied phone. Cannot be forged without the secret.
//  - RECOVERY TOKEN: longer-lived (30d) signed token bound to the identity.
//    Replaces the RAW PHONE that used to sit in localStorage (which was itself
//    the credential). Used only for silent iOS-PWA session recovery.
//
// Trade-off vs a store: a signed ticket is replayable within its TTL and cannot
// be individually revoked. Mitigated by a very short auth-ticket TTL (180s) —
// capturing one requires already compromising the victim's TLS/device, at which
// point the session cookie itself is exposed. If a real Redis is ever wired,
// swap the sign/verify internals for GETDEL-based single-use; the exported
// signatures below stay the same so nothing else changes.
// ============================================

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';

const TICKET_TTL_S = 180;                 // 3 minutes to complete signIn
const RECOVERY_TTL_S = 30 * 24 * 60 * 60; // 30 days
const TICKET_PURPOSE = 'ticket';
const RECOVERY_PURPOSE = 'recovery';

export type AuthMethod = 'phone' | 'email';

export interface AuthSubject {
  method: AuthMethod;
  phone?: string;      // normalized, for phone method
  partnerId?: number;  // for email method
  email?: string;      // for email method
}

interface Payload extends AuthSubject {
  p: string;   // purpose
  iat: number; // issued-at (s)
  exp: number; // expiry (s)
  jti: string; // nonce (uniqueness)
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sign(payloadB64: string): string {
  return b64url(createHmac('sha256', SECRET).update(payloadB64).digest());
}

function encode(subject: AuthSubject, purpose: string, ttl: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = {
    method: subject.method,
    phone: subject.phone,
    partnerId: subject.partnerId,
    email: subject.email,
    p: purpose,
    iat: now,
    exp: now + ttl,
    jti: b64url(randomBytes(9)),
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${sign(payloadB64)}`;
}

function decode(token: string | undefined | null, purpose: string): AuthSubject | null {
  if (!SECRET) return null;
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  // constant-time signature check
  const expected = sign(payloadB64);
  let sigBuf: Buffer, expBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, 'base64url');
    expBuf = Buffer.from(expected, 'base64url');
  } catch {
    return null;
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.p !== purpose) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;

  return {
    method: payload.method,
    phone: payload.phone,
    partnerId: payload.partnerId,
    email: payload.email,
  };
}

// ---- Auth tickets (short-lived, signed) ----

export async function issueAuthTicket(subject: AuthSubject): Promise<string> {
  return encode(subject, TICKET_PURPOSE, TICKET_TTL_S);
}

/** Verify signature + expiry. Returns the subject, or null if invalid/expired. */
export async function consumeAuthTicket(
  token: string | undefined | null
): Promise<AuthSubject | null> {
  return decode(token, TICKET_PURPOSE);
}

// ---- Recovery tokens (longer-lived, signed) ----

export async function issueRecoveryToken(subject: AuthSubject): Promise<string> {
  return encode(subject, RECOVERY_PURPOSE, RECOVERY_TTL_S);
}

/**
 * Validate a recovery token and reissue a fresh one (rotation). Returns the
 * subject + the new token, or null if invalid/expired. (Stateless: the old
 * token remains valid until its own expiry.)
 */
export async function rotateRecoveryToken(
  token: string | undefined | null
): Promise<{ subject: AuthSubject; newToken: string } | null> {
  const subject = decode(token, RECOVERY_PURPOSE);
  if (!subject) return null;
  const newToken = await issueRecoveryToken(subject);
  return { subject, newToken };
}
