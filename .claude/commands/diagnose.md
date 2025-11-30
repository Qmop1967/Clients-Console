Run health check for TSH Clients Console.

## Quick Checks

```bash
# 1. Site responding
curl -s -o /dev/null -w "%{http_code}" https://www.tsh.sale
# Expected: 200

# 2. Token working
curl "https://www.tsh.sale/api/debug/token"

# 3. Prices loading
curl "https://www.tsh.sale/api/debug/prices"

# 4. Stock displaying
curl "https://www.tsh.sale/api/debug/stock"
```

## Diagnostic Checklist

### Infrastructure
- [ ] Production site responds
- [ ] Vercel deployment healthy
- [ ] Upstash Redis accessible

### Zoho Integration
- [ ] OAuth token caching
- [ ] Products fetching
- [ ] Prices displaying
- [ ] Stock showing correctly

### User Experience
- [ ] Shop page loads
- [ ] Prices show (not all "Contact for price")
- [ ] Login flow works
- [ ] Arabic RTL works

## Quick Fixes

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

## Vercel Commands

```bash
vercel logs --prod           # View logs
vercel logs --prod --follow  # Real-time logs
vercel env ls production     # Check env vars
```

## Local Check

```bash
cd "/Users/khaleelal-mulla/General/ Projects/tsh-clients-console"
npm run build  # Check for errors
npm run lint   # Check linting
npm run dev    # Test locally
```
