# TSH Clients Console - Deployment Guide

## Deployment Mode: GitHub Actions (Two-Branch Workflow)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  preview branch ──→ GitHub Actions ──→ staging.tsh.sale        │
│       │                                    │                    │
│       │              User verifies         │                    │
│       ↓                   ↓                ↓                    │
│  main branch ──→ NO AUTO-DEPLOY ──→ Manual via Vercel Dashboard │
│                                           │                    │
│                                           ↓                    │
│                                    www.tsh.sale (PRODUCTION)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Branch Strategy

| Branch | Purpose | Auto-Deploy | Target |
|--------|---------|-------------|--------|
| `preview` | Development & staging | Yes (GitHub Actions) | staging.tsh.sale |
| `main` | Production-ready code | **NO** | Manual only via Vercel Dashboard |

---

## Commands for Claude Code

### Deploy to Staging (ALLOWED)

```bash
# 1. Ensure you're on preview branch
git checkout preview

# 2. Stage and commit changes
git add -A
git commit -m "feat: description of changes"

# 3. Push to preview branch (triggers GitHub Actions)
git push origin preview

# 4. GitHub Actions deploys to staging.tsh.sale automatically
```

### Production Deployment (FORBIDDEN for Claude Code)

```yaml
⛔ Claude Code is STRICTLY FORBIDDEN from:
  - Pushing to main branch
  - Running vercel --prod
  - Deploying directly to production
  - Promoting preview to production

✅ ONLY the user can:
  - Push to main branch
  - Deploy to production via Vercel Dashboard
```

---

## URLs

| Environment | URL | Deployed By |
|-------------|-----|-------------|
| Local | http://localhost:3000 | `npm run dev` |
| Staging | https://staging.tsh.sale | GitHub Actions (auto) |
| Production | https://www.tsh.sale | User (manual) |

---

## GitHub Actions Configuration

**Workflow File:** `.github/workflows/preview.yml`

**Trigger:** Push to `preview` branch ONLY

**GitHub Secrets Required:**
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - team_rgs5sBv5aI1FH5pFAAfflSTd
- `VERCEL_PROJECT_ID` - prj_WayTPxtTtlwrZCZZEy8xD4kyAxds

---

## Rollback

If staging has issues:
```bash
# View recent deployments
vercel ls

# Rollback to previous
vercel rollback [deployment-url]
```

If production has issues:
```yaml
User must:
1. Go to Vercel Dashboard
2. Find previous working deployment
3. Click "Promote to Production"
```

---

## Environment Variables

Ensure these are set in Vercel dashboard:

**Required:**
- `NEXTAUTH_URL` - Production URL
- `NEXTAUTH_SECRET` - Secure secret
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ORGANIZATION_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`

---

## Namecheap DNS

Current DNS configuration for tsh.sale:
```
www      CNAME   cname.vercel-dns.com
staging  CNAME   cname.vercel-dns.com
_vercel  TXT     vc-domain-verify=www.tsh.sale,bc19ea0be7b464684bb8
```

---

## Pre-Deployment Checklist

Before pushing to `preview`:
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Tested locally with `npm run dev`
- [ ] All translations added (EN + AR)
- [ ] No emoji console.log statements

Before user deploys to production:
- [ ] Staging verified at staging.tsh.sale
- [ ] No critical bugs found
- [ ] Performance acceptable (TTFB < 1s)

---

## Emergency Contacts

- Vercel Status: https://vercel-status.com
- Zoho Status: https://status.zoho.com
- Upstash Status: https://status.upstash.com
