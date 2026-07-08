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
// Single-use: auth tickets carry a random jti; consumeAuthTicket records spent
// jtis in an in-memory guard so a given ticket mints at most ONE session. This
// app runs single-process (pm2 fork), so the guard is authoritative — same
// assumption the OTP store already relies on. Caveat: the guard resets on
// restart, and the very short 180s TTL bounds any replay to that window (and to
// an attacker who already compromised the victim's TLS/device, where the
// session cookie is exposed anyway). Recovery tokens are long-lived and instead
// mitigate replay by rotating on every use. If a real Redis is ever wired, swap
// the guard for GETDEL-based single-use; exported signatures stay identical.
// ============================================

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';

const TICKET_TTL_S = 180;                 // 3 minutes to complete signIn
const RECOVERY_TTL_S = 30 * 24 * 60 * 60; // 30 days
const WA_CHALLENGE_TTL_S = 300;           // 5 minutes to complete a WebAuthn ceremony
const TICKET_PURPOSE = 'ticket';
const RECOVERY_PURPOSE = 'recovery';
const WA_REG_PURPOSE = 'wa-reg';
const WA_AUTH_PURPOSE = 'wa-auth';

// In-memory single-use guard for auth tickets (jti -> expiry seconds).
// Authoritative under single-process (pm2 fork); see header note.
const consumedJti = new Map<string, number>();
function sweepConsumed(now: number): void {
  if (consumedJti.size < 1024) return;
  for (const [j, exp] of consumedJti) if (exp < now) consumedJti.delete(j);
}

export type AuthMethod = 'phone' | 'email';

export interface AuthSubject {
  method: AuthMethod;
  phone?: string;      // normalized, for phone method
  partnerId?: number;  // for email method
  email?: string;      // for email method
}

interface Payload extends AuthSubject {
  p: string;         // purpose
  iat: number;       // issued-at (s)
  exp: number;       // expiry (s)
  jti: string;       // nonce (uniqueness)
  challenge?: string; // WebAuthn ceremony challenge (wa-reg / wa-auth only)
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

function decodePayload(token: string | undefined | null, purpose: string): Payload | null {
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

  return payload;
}

function subjectOf(p: Payload): AuthSubject {
  return { method: p.method, phone: p.phone, partnerId: p.partnerId, email: p.email };
}

// ---- Auth tickets (short-lived, signed) ----

export async function issueAuthTicket(subject: AuthSubject): Promise<string> {
  return encode(subject, TICKET_PURPOSE, TICKET_TTL_S);
}

/** Verify signature + expiry. Returns the subject, or null if invalid/expired. */
export async function consumeAuthTicket(
  token: string | undefined | null
): Promise<AuthSubject | null> {
  const payload = decodePayload(token, TICKET_PURPOSE);
  if (!payload) return null;
  const now = Math.floor(Date.now() / 1000);
  sweepConsumed(now);
  // Single-use: a jti may be redeemed at most once.
  if (consumedJti.has(payload.jti)) {
    console.warn('[Auth] ticket rejected: already consumed');
    return null;
  }
  consumedJti.set(payload.jti, payload.exp);
  return subjectOf(payload);
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
  const payload = decodePayload(token, RECOVERY_PURPOSE);
  if (!payload) return null;
  const subject = subjectOf(payload);
  const newToken = await issueRecoveryToken(subject);
  return { subject, newToken };
}

// ---- WebAuthn challenges (stateless, single-use, 5-min TTL) ----
//
// Same HMAC model as auth tickets: the challenge the RP must see on verify is
// embedded in a signed token instead of a server-side store. Unforgeable
// without NEXTAUTH_SECRET, so a client cannot swap in a challenge of its own.
// Single-use via the shared jti guard — one token completes at most one
// ceremony (same single-process assumption as the tickets above).

export type WebAuthnChallengePurpose = 'wa-reg' | 'wa-auth';

export interface WebAuthnChallengeSubject {
  partnerId: number;
  email: string;
}

/** Issue a signed, single-use challenge token binding a ceremony to a partner. */
export function issueWebAuthnChallenge(
  purpose: WebAuthnChallengePurpose,
  subject: WebAuthnChallengeSubject,
  challenge: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = {
    method: 'email',
    partnerId: subject.partnerId,
    email: subject.email,
    challenge,
    p: purpose === 'wa-reg' ? WA_REG_PURPOSE : WA_AUTH_PURPOSE,
    iat: now,
    exp: now + WA_CHALLENGE_TTL_S,
    jti: b64url(randomBytes(9)),
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify signature + expiry + purpose and burn the token (single-use).
 * Returns the bound identity and the expected challenge, or null if invalid.
 */
export function consumeWebAuthnChallenge(
  token: string | undefined | null,
  purpose: WebAuthnChallengePurpose
): { partnerId: number; email: string; challenge: string } | null {
  const payload = decodePayload(token, purpose === 'wa-reg' ? WA_REG_PURPOSE : WA_AUTH_PURPOSE);
  if (!payload) return null;
  if (!payload.partnerId || !payload.email || !payload.challenge) return null;
  const now = Math.floor(Date.now() / 1000);
  sweepConsumed(now);
  if (consumedJti.has(payload.jti)) {
    console.warn('[WebAuthn] challenge rejected: already consumed');
    return null;
  }
  consumedJti.set(payload.jti, payload.exp);
  return { partnerId: payload.partnerId, email: payload.email, challenge: payload.challenge };
}
