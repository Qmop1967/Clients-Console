// ============================================
// In-Memory OTP Store with TTL
// ============================================
// Simple, no external dependencies (no Redis needed)
// Works for single PM2 instance
// ============================================

interface OTPEntry {
  code: string;
  phone: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OTPEntry>();
const MAX_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MS = 60 * 1000; // 1 minute between sends
const rateLimit = new Map<string, number>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
  for (const [key, time] of rateLimit) {
    if (time + RATE_LIMIT_MS < now) rateLimit.delete(key);
  }
}, 5 * 60 * 1000);

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize any Iraqi phone format to +9647xxxxxxxxx
// Accepts: 7901234567, 07901234567, 9647901234567, 009647901234567, +9647901234567
export function normalizePhone(phone: string): string {
  // If it looks like an email, return as-is (for email OTP)
  if (phone.includes("@")) return phone.trim().toLowerCase();
  
  // Remove spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Remove leading 00 (international dialing prefix)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // Now we should have one of:
  // 7xxxxxxxxx (10 digits, no prefix)
  // 07xxxxxxxxx (11 digits, local)
  // 9647xxxxxxxxx (13 digits, country code)
  
  // Remove leading 0
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // If starts with 7 and 10 digits — add country code
  if (cleaned.startsWith('7') && cleaned.length === 10) {
    cleaned = '964' + cleaned;
  }
  
  // Should now be 9647xxxxxxxxx (13 digits)
  return '+' + cleaned;
}

// For WhatsApp: return number without + prefix (E.164)
export function whatsappNumber(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized.startsWith('+') ? normalized.substring(1) : normalized;
}

export function isRateLimited(key: string): boolean {
  const normalized = key.includes("@") ? key.trim().toLowerCase() : normalizePhone(key);
  const lastSent = rateLimit.get(normalized);
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
    return true;
  }
  return false;
}

export function storeOTP(phone: string, code: string): void {
  const normalized = normalizePhone(phone);
  store.set(normalized, {
    code,
    phone: normalized,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  rateLimit.set(normalized, Date.now());
}

export function verifyOTP(phone: string, code: string): { valid: boolean; error?: string } {
  const normalized = normalizePhone(phone);
  const entry = store.get(normalized);

  if (!entry) {
    return { valid: false, error: 'expired' };
  }

  if (entry.expiresAt < Date.now()) {
    store.delete(normalized);
    return { valid: false, error: 'expired' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(normalized);
    return { valid: false, error: 'max_attempts' };
  }

  entry.attempts++;

  if (entry.code !== code.trim()) {
    return { valid: false, error: 'invalid' };
  }

  // Success — delete OTP
  store.delete(normalized);
  return { valid: true };
}
