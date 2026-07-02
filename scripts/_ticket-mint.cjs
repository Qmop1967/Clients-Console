// Test-only: mint HMAC auth/recovery tokens identical to src/lib/auth-tickets.ts.
// Requires TICKET_SECRET env (= NEXTAUTH_SECRET). Grants no privilege beyond
// what reading the server secret already would.
const crypto = require('crypto');
const SECRET = process.env.TICKET_SECRET || '';
if (!SECRET) { console.error('no TICKET_SECRET'); process.exit(2); }
const b64 = (b) => Buffer.from(b).toString('base64url');
function mint({ method, phone, partnerId, email, purpose, ttl }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { method, phone, partnerId, email, p: purpose, iat: now, exp: now + ttl, jti: b64(crypto.randomBytes(9)) };
  const pb = b64(Buffer.from(JSON.stringify(payload)));
  const sig = b64(crypto.createHmac('sha256', SECRET).update(pb).digest());
  return pb + '.' + sig;
}
const [, , purpose, method, value, partnerId, ttl] = process.argv;
const subj = method === 'email'
  ? { method, email: value, partnerId: Number(partnerId || 0) }
  : { method, phone: value };
process.stdout.write(mint({ ...subj, purpose: purpose === 'recovery' ? 'recovery' : 'ticket', ttl: Number(ttl || 180) }));
