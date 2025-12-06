# Quick Reference - TSH Clients Console

## 30-Second Facts

```yaml
Project: TSH Clients Console (B2B Wholesale Portal)
Stack: Next.js 15 + TypeScript + TailwindCSS + shadcn/ui
i18n: English + Arabic (RTL)
Auth: Magic Link via Resend
API: Zoho Books + Zoho Inventory
Deployment: GitHub Actions → Vercel
  Staging: Push to 'preview' branch (auto-deploy)
  Production: Manual via Vercel Dashboard
Domains:
  - staging.tsh.sale (preview branch)
  - www.tsh.sale (production)
```

---

## Critical IDs (MEMORIZE)

| Entity | ID |
|--------|-----|
| Organization | `748369814` |
| WholeSale Warehouse | `2646610000000077024` |
| Consumer Price List | `2646610000049149103` |

**Full price list reference:** See `PRICING_RULES.md`

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/zoho-debug` | Debug Zoho API issues |
| `/zoho-price` | Price list reference |
| `/zoho-stock` | Stock rules reference |
| `/zoho-sync` | Revalidate caches |
| `/deploy` | Deployment workflow |
| `/i18n-add` | Add translations |
| `/diagnose` | Health check |
| `/cache-clear` | Clear caches |
| `/logs` | View Vercel logs |

---

## Key Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run typecheck    # Check TypeScript

# Git Workflow (GitHub Actions handles deployment)
git checkout preview                    # Ensure you're on preview branch
git add -A && git commit -m "feat: ..."  # Commit changes
git push origin preview                  # Triggers staging deploy

# ⛔ FORBIDDEN (Claude Code cannot deploy to production)
# git push origin main
# vercel --prod --yes

# Cache Revalidation
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"

# Stock Sync Health Check
curl "https://www.tsh.sale/api/sync/stock?action=status&secret=tsh-stock-sync-2024"
```

---

## Documentation Quick Links

| File | What |
|------|------|
| `PROJECT_MEMORY.md` | Critical IDs, golden rules (**READ EVERY SESSION**) |
| `TROUBLESHOOTING.md` | Decision trees for issues |
| `ZOHO_INTEGRATION.md` | API reference |
| `PRICING_RULES.md` | Price list logic |
| `STOCK_RULES.md` | Stock calculation |
| `COMPONENT_PATTERNS.md` | UI patterns |

---

## File Locations

| What | Where |
|------|-------|
| Pages | `src/app/[locale]/` |
| Components | `src/components/` |
| Zoho Services | `src/lib/zoho/` |
| Auth Config | `src/lib/auth/` |
| Translations | `src/messages/{en,ar}.json` |
| Claude Docs | `.claude/` |
| Commands | `.claude/commands/` |

---

## Golden Rules

1. **Prices**: NEVER use `item.rate` → ALWAYS use pricebook price
2. **Stock**: Use `location_available_for_sale_stock` from `locations` array
3. **Deploy**: Push to `preview` branch → GitHub Actions → staging.tsh.sale
4. **Production**: User manually deploys via Vercel Dashboard (Claude Code FORBIDDEN)
5. **i18n**: Always add both EN + AR translations
6. **Token**: Cached in Upstash Redis (prevents rate limiting)

---

## Troubleshooting Quick Fixes

### "Contact for price" everywhere
```bash
curl "https://www.tsh.sale/api/debug/token"
# Check UPSTASH env vars in Vercel
```

### Stock shows 0
```bash
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

### Stale data
```bash
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```

---

## URLs

| Purpose | URL |
|---------|-----|
| Staging | https://staging.tsh.sale |
| Production | https://www.tsh.sale |
| Vercel Dashboard | https://vercel.com/tsh-03790822/tsh-clients-console |
| Upstash Console | https://console.upstash.com |
| Zoho Books | https://books.zoho.com/app#/748369814 |
| Zoho Inventory | https://inventory.zoho.com/app#/home/748369814 |
