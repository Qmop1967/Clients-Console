# Deploy Command

Deploy changes to staging or production environments.

## Deployment Rules

```yaml
STAGING (Automatic):
  ✅ Push to `preview` branch anytime
  ✅ GitHub Actions deploys to staging.tsh.sale

PRODUCTION (On User Request Only):
  ✅ Push to `main` branch ONLY when user explicitly requests
  ✅ GitHub Actions deploys to www.tsh.sale
  ⚠️ NEVER deploy to production without user explicitly asking
```

## Deployment Workflow

```
preview branch → GitHub Actions → staging.tsh.sale
      ↓
User requests production deployment
      ↓
main branch → GitHub Actions → www.tsh.sale (PRODUCTION)
```

## Staging Deployment

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

## Production Deployment (ONLY when user explicitly requests)

```bash
# 1. Ensure preview is up to date
git checkout preview
git pull origin preview

# 2. Switch to main and merge preview
git checkout main
git pull origin main
git merge preview

# 3. Push to main (triggers production deployment)
git push origin main

# 4. Switch back to preview for future work
git checkout preview
```

## URLs

| Environment | URL | Trigger |
|-------------|-----|---------|
| Staging | staging.tsh.sale | Push to `preview` branch |
| Production | www.tsh.sale | Push to `main` branch (user request only) |

## Post-deployment Verification

1. **Staging:** Visit https://staging.tsh.sale
2. **Production:** Visit https://www.tsh.sale

3. **Revalidate caches if needed**
   ```bash
   # Staging
   curl "https://staging.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"

   # Production
   curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
   ```

## If Deployment Fails

1. **Check GitHub Actions logs**
   - Go to: https://github.com/Qmop1967/Clients-Console/actions
   - Find the failed workflow run
   - Check error messages

2. **Common issues:**
   - TypeScript errors → Fix type issues
   - Missing env vars → Check Vercel dashboard
   - Import errors → Check file paths
