# Deploy to Staging (Preview Branch)

This command deploys changes to the staging environment via the `preview` branch.

## CRITICAL: Deployment Rules

```yaml
ALLOWED for Claude Code:
  ✅ Push to `preview` branch → Auto-deploys to staging.tsh.sale

FORBIDDEN for Claude Code:
  ❌ Push to `main` branch
  ❌ Run `vercel --prod` or any production deployment
  ❌ Deploy directly to www.tsh.sale
  ❌ Merge `preview` to `main` without user approval

Production deployment is USER-ONLY via Vercel Dashboard.
```

## Deployment Workflow

```
preview branch → GitHub Actions → staging.tsh.sale
      ↓
User verifies staging
      ↓
User merges to main (optional, for production-ready code)
      ↓
User deploys to production via Vercel Dashboard → www.tsh.sale
```

## Pre-deployment Checklist

- [ ] On `preview` branch (run `git checkout preview` if needed)
- [ ] All changes committed
- [ ] Build passes locally: `npm run build`
- [ ] No TypeScript errors
- [ ] Translations complete (EN + AR)

## Deploy Commands

```bash
# Ensure on preview branch
git checkout preview

# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "feat: description of changes"

# Push to preview branch (triggers staging deployment)
git push origin preview
```

## After Deployment

1. Tell user: "Changes pushed to preview branch"
2. Tell user: "GitHub Actions is deploying to staging.tsh.sale"
3. Tell user: "Verify changes on staging.tsh.sale"
4. Tell user: "Deploy to production via Vercel Dashboard when ready"

## Post-deployment Verification

1. **Visit staging site**
   ```
   https://staging.tsh.sale
   ```

2. **Check product prices display**
   - Products should show IQD prices
   - NOT "Contact for price" for all items

3. **Test login flow**
   - Click Sign In
   - Enter email
   - Check for magic link email

4. **Verify Arabic RTL layout**
   - Switch to Arabic (ar)
   - Confirm RTL layout works
   - Check translations display

5. **Revalidate caches if needed**
   ```bash
   curl "https://staging.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
   ```

## URLs

| Environment | URL | Deployed By | Trigger |
|-------------|-----|-------------|---------|
| Staging | staging.tsh.sale | GitHub Actions | Push to `preview` |
| Production | www.tsh.sale | User (Vercel Dashboard) | Manual only |
| Vercel Dashboard | https://vercel.com/tsh-03790822/tsh-clients-console | - | - |

## If Deployment Fails

1. **Check GitHub Actions logs**
   - Go to: https://github.com/Qmop1967/Clients-Console/actions
   - Find the failed workflow run
   - Check error messages

2. **Common issues:**
   - TypeScript errors → Fix type issues
   - Missing env vars → Check Vercel dashboard
   - Import errors → Check file paths

3. **Manual staging deployment (if GitHub Actions fails)**
   ```bash
   vercel --yes
   ```
   Note: This deploys to preview, NOT production.

## Production Deployment (USER ONLY)

Production deployment is FORBIDDEN for Claude Code.

User must:
1. Verify changes on staging.tsh.sale
2. Go to Vercel Dashboard: https://vercel.com/tsh-03790822/tsh-clients-console
3. Click "Deployments"
4. Find the latest preview deployment
5. Click "..." → "Promote to Production"

Or:
1. User pushes preview to main: `git checkout main && git merge preview && git push origin main`
2. User deploys via Vercel Dashboard
