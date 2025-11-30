View logs for TSH Clients Console.

## Vercel Logs

```bash
# Recent logs
vercel logs --prod

# Real-time
vercel logs --prod --follow

# Last hour
vercel logs --prod --since 1h

# Filter errors
vercel logs --prod | grep -i error
```

## Dashboard Logs

1. https://vercel.com/tsh-03790822/tsh-clients-console
2. Click "Deployments"
3. Select latest deployment
4. Go to "Functions" tab

## Debug Endpoints

```bash
curl "https://www.tsh.sale/api/debug/token"
curl "https://www.tsh.sale/api/debug/prices"
curl "https://www.tsh.sale/api/debug/stock"
```

## Common Log Patterns

| Log | Meaning |
|-----|---------|
| `401 Unauthorized` | Token expired |
| `Rate limited by Zoho` | Token not cached |
| `No session found` | User not logged in |
| `Cache miss` | Normal, fetching fresh |

## Browser DevTools

1. F12 → Console tab (JS errors)
2. F12 → Network tab (API calls)

## Adding Debug Logs

```typescript
console.log('[DEBUG] Data:', { data });
console.error('[ERROR] Failed:', error);
```

Remember to remove before deploying.
