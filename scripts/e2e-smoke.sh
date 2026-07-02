#!/bin/bash
# TSH Clients — E2E smoke suite (2026-07-02)
# Fixture: partner 4151 "عميل تجريبي — TSH E2E TEST", phone 07700009911.
# Financial docs are seeded on demand (see docs in tsh-storefront-ui skill);
# balance assertions below assume the standard fixture: opening 50,000
# + invoice 25,000 (INV id passed as $2) - payment 30,000 = 45,000 IQD.
# Usage: ./scripts/e2e-smoke.sh [base_url] [invoice_id]
set -u
BASE="${1:-http://localhost:3002}"; INV_ID="${2:-21404}"
CJ=$(mktemp); PASS=0; FAIL=0
DIR="$(cd "$(dirname "$0")" && pwd)"
# SECURITY 2026-07-02: login now requires a server-vouched ticket. Mint one for
# the fixture phone (same HMAC as the app; needs the server secret).
SECRET="$(grep -hE '^NEXTAUTH_SECRET=' "$DIR/../.env.local" "$DIR/../.env" 2>/dev/null | head -1 | cut -d= -f2-)"
TICKET="$(TICKET_SECRET="$SECRET" node "$DIR/_ticket-mint.cjs" ticket phone 07700009911)"
ck(){ if echo "$2" | grep -qF "$3"; then echo "  ✅ $1"; PASS=$((PASS+1)); else echo "  ❌ $1"; FAIL=$((FAIL+1)); fi; }
ckNOT(){ if echo "$2" | grep -qF "$3"; then echo "  ❌ $1 (forbidden text present)"; FAIL=$((FAIL+1)); else echo "  ✅ $1"; PASS=$((PASS+1)); fi; }
echo "── [1] LOGIN ──"
CSRF=$(curl -s -c "$CJ" "$BASE/api/auth/csrf" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b "$CJ" -c "$CJ" -o /dev/null -X POST "$BASE/api/auth/callback/phone" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "phone=07700009911" --data-urlencode "ticket=$TICKET" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "callbackUrl=$BASE/ar/dashboard"
grep -q "session-token" "$CJ" && { echo "  ✅ session created"; PASS=$((PASS+1)); } || { echo "  ❌ no session"; FAIL=$((FAIL+1)); }
echo "── [2] DASHBOARD ──"
DASH=$(curl -s -b "$CJ" "$BASE/ar/dashboard")
ck "balance 45,000 (ledger truth)" "$DASH" "45,000"
echo "── [3] STATEMENT ──"
ST=$(curl -s -b "$CJ" "$BASE/ar/account-statement")
ck "closing == dashboard (45,000)" "$ST" "45,000"
ck "opening entry 50,000 visible" "$ST" "50,000"
ck "journal-entry badge" "$ST" "قيد / رصيد افتتاحي"
ck "payment 30,000 row" "$ST" "30,000"
echo "── [4] INVOICE DETAIL ──"
DET=$(curl -s -b "$CJ" "$BASE/ar/invoices/$INV_ID")
ck "clean label [TSH-0744]" "$DET" "[TSH-0744] Cleaner Foam"
ckNOT "no description leak" "$DET" "منتج إلكتروني"
ck "payments history card" "$DET" "سجل الدفعات"
echo "── [5] INVOICE PRINT ──"
PR=$(curl -s -b "$CJ" "$BASE/ar/invoices/$INV_ID/print")
ck "clean label" "$PR" "[TSH-0744] Cleaner Foam"
ckNOT "no description leak (payload incl.)" "$PR" "منتج إلكتروني"
ck "totals rendered" "$PR" "25,000"
ck "print pagination CSS" "$PR" "overflow: visible !important"
rm -f "$CJ"; echo "═════ RESULT: PASS=$PASS FAIL=$FAIL ═════"
[ $FAIL -eq 0 ] && echo "🟢 GREEN" || { echo "🔴 RED"; exit 1; }
