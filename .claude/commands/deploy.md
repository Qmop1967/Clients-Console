Deploy TSH Clients Console to production.

## Pre-deployment Checklist

- [ ] All changes committed to git
- [ ] Build passes locally: `npm run build`
- [ ] No TypeScript errors
- [ ] Translations complete (EN + AR)
- [ ] Tested locally: `npm run dev`

## Deploy Command

```bash
cd "/Users/khaleelal-mulla/General/ Projects/tsh-clients-console"
vercel --prod --yes
```

## Post-deployment Verification

1. **Visit production site**
   ```
   https://www.tsh.sale
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
   curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
   ```

## URLs

| Environment | URL |
|-------------|-----|
| Production | https://www.tsh.sale |
| Staging | https://staging.tsh.sale |
| Vercel Dashboard | https://vercel.com/tsh-03790822/tsh-clients-console |

## If Deployment Fails

1. **Check build logs**
   ```bash
   vercel logs --prod
   ```

2. **Common issues:**
   - TypeScript errors → Fix type issues
   - Missing env vars → Check Vercel dashboard
   - Import errors → Check file paths

3. **Rollback if needed**
   - Go to Vercel Dashboard → Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"

## Environment Variables

Ensure these are set in Vercel Dashboard → Settings → Environment Variables:

```
NEXTAUTH_URL=https://www.tsh.sale
NEXTAUTH_SECRET=[secret]
ZOHO_CLIENT_ID=[id]
ZOHO_CLIENT_SECRET=[secret]
ZOHO_REFRESH_TOKEN=[token]
ZOHO_ORGANIZATION_ID=748369814
UPSTASH_REDIS_REST_URL=https://fine-mole-41883.upstash.io
UPSTASH_REDIS_REST_TOKEN=[token]
RESEND_API_KEY=[key]
EMAIL_FROM=TSH <noreply@tsh.sale>
```
