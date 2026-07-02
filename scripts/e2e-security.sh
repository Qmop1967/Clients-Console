#!/bin/bash
# TSH Clients — SECURITY E2E (2026-07-02). Proves phone-alone session forgery is
# blocked and the legit ticket path works. Mints test tickets with the server
# secret (see _ticket-mint.cjs). Usage: ./scripts/e2e-security.sh [base_url]
set -u
BASE="${1:-http://localhost:3002}"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
SECRET="$(grep -hE '^NEXTAUTH_SECRET=' "$ROOT/.env.local" "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2-)"
[ -z "$SECRET" ] && { echo "no NEXTAUTH_SECRET"; exit 2; }
PHONE="07700009911"   # fixture partner 4151
mint(){ TICKET_SECRET="$SECRET" node "$DIR/_ticket-mint.cjs" "$@"; }
PASS=0; FAIL=0
has_session(){
  local ck; ck="$(mktemp)"
  local csrf; csrf="$(curl -s -c "$ck" "$BASE/api/auth/csrf" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")"
  curl -s -b "$ck" -c "$ck" -o /dev/null -X POST "$BASE/api/auth/callback/phone" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "phone=$1" --data-urlencode "ticket=${2:-}" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "callbackUrl=$BASE/ar/dashboard"
  if grep -q "session-token" "$ck"; then echo 1; else echo 0; fi
  rm -f "$ck"
}
assert_no(){ if [ "$1" = "0" ]; then echo "  ✅ $2"; PASS=$((PASS+1)); else echo "  ❌ $2 — SESSION MINTED"; FAIL=$((FAIL+1)); fi; }
assert_yes(){ if [ "$1" = "1" ]; then echo "  ✅ $2"; PASS=$((PASS+1)); else echo "  ❌ $2 — no session"; FAIL=$((FAIL+1)); fi; }
echo "── SEC-1: phone alone, NO ticket (the exploit) ──"
assert_no "$(has_session "$PHONE" "")" "phone-only forges NO session"
echo "── SEC-2: garbage ticket ──"
assert_no "$(has_session "$PHONE" "not.a.real.ticket")" "forged ticket rejected"
echo "── SEC-3: valid ticket bound to a DIFFERENT phone ──"
BAD="$(mint ticket phone 07700000000)"
assert_no "$(has_session "$PHONE" "$BAD")" "ticket/phone mismatch rejected"
echo "── SEC-4: valid ticket for the right phone ──"
GOOD="$(mint ticket phone "$PHONE")"
assert_yes "$(has_session "$PHONE" "$GOOD")" "legit ticket mints session"
echo "── SEC-7: REPLAY the same ticket (must be single-use) ──"
assert_no "$(has_session "$PHONE" "$GOOD")" "consumed ticket cannot be replayed"
echo "── SEC-5: recovery token → /api/auth/recover → ticket → session ──"
REC="$(mint recovery phone "$PHONE" 0 2592000)"
RESP="$(curl -s -X POST "$BASE/api/auth/recover" -H "Content-Type: application/json" -d "{\"recoveryToken\":\"$REC\"}")"
RTICKET="$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ticket',''))" 2>/dev/null)"
if [ -n "$RTICKET" ]; then echo "  ✅ recover issued a ticket"; PASS=$((PASS+1)); else echo "  ❌ recover gave no ticket: $RESP"; FAIL=$((FAIL+1)); fi
assert_yes "$(has_session "$PHONE" "$RTICKET")" "recovered ticket mints session"
echo "── SEC-6: recovery rejects garbage → 401 ──"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/recover" -H "Content-Type: application/json" -d '{"recoveryToken":"garbage"}')"
if [ "$CODE" = "401" ]; then echo "  ✅ invalid recovery token → 401"; PASS=$((PASS+1)); else echo "  ❌ expected 401 got $CODE"; FAIL=$((FAIL+1)); fi
echo "═════ SECURITY: PASS=$PASS FAIL=$FAIL ═════"
[ $FAIL -eq 0 ] && echo "🟢 SECURE" || { echo "🔴 INSECURE / not deployed"; exit 1; }
