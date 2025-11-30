Debug Zoho API issues for TSH Clients Console.

## Quick Diagnosis Steps

1. **Check Token Status**
   ```bash
   curl "https://www.tsh.sale/api/debug/token"
   ```
   - Success → Token is valid, continue to step 2
   - Rate limited → Wait 10 seconds, token cache may be broken
   - Token expired → Check ZOHO_REFRESH_TOKEN in Vercel

2. **Check Price Fetching**
   ```bash
   curl "https://www.tsh.sale/api/debug/prices"
   ```
   - Prices loaded → Price list working
   - "Contact for price" → Item not in pricebook OR token issue

3. **Check Stock Display**
   ```bash
   curl "https://www.tsh.sale/api/debug/stock"
   ```
   - Shows stock → Working correctly
   - Shows 0 → Check warehouse ID and field name

4. **Revalidate Caches**
   ```bash
   curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
   ```

## Common Issues

### "Contact for price" on all products
**Cause:** Zoho OAuth rate limiting (token not cached)
**Solution:**
1. Check Upstash Redis is configured in Vercel
2. Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
3. Check Upstash console for cached token

### 401 Unauthorized errors
**Cause:** Access token expired and refresh failed
**Solution:**
1. Check ZOHO_REFRESH_TOKEN in Vercel env vars
2. Generate new refresh token if expired
3. Redeploy: `vercel --prod --yes`

### Products not updating
**Cause:** Stale cache
**Solution:**
```bash
curl "https://www.tsh.sale/api/revalidate?tag=products&secret=tsh-revalidate-2024"
```

## Vercel Function Logs

```bash
# View recent logs
vercel logs --prod

# Filter for errors
vercel logs --prod | grep -i error
```

## Key Files to Check

- Token caching: `src/lib/zoho/client.ts`
- Price fetching: `src/lib/zoho/price-lists.ts`
- Product API: `src/lib/zoho/products.ts`
- Stock logic: `src/lib/zoho/products.ts` → `getWholesaleAvailableStock()`

## Environment Variables (Vercel)

Required for Zoho:
- ZOHO_CLIENT_ID
- ZOHO_CLIENT_SECRET
- ZOHO_REFRESH_TOKEN
- ZOHO_ORGANIZATION_ID (748369814)

Required for caching:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
