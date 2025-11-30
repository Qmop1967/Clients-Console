# TSH Clients Console - Deployment Guide

## Deployment Mode: Direct to Production

```
┌─────────────┐     ┌─────────────┐
│   Develop   │ ──▶ │ Production  │
│   Locally   │     │  (Direct)   │
└─────────────┘     └─────────────┘
```

## Commands

### Deploy to Production (Default)
```bash
cd "/Users/khaleelal-mulla/General/ Projects/tsh-clients-console"
vercel --prod --yes
```

### Deploy to Staging (If Needed)
```bash
vercel --yes
```

## URLs

| Environment | URL |
|-------------|-----|
| Local | http://localhost:3000 |
| Production | https://www.tsh.sale |
| Production Alt | https://tsh-clients-console.vercel.app |
| Staging | https://staging.tsh.sale |

## Rollback

If production has issues:
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel rollback [deployment-url]
```

## Environment Variables

Ensure these are set in Vercel dashboard:
- `NEXTAUTH_URL` - Set to production URL
- `NEXTAUTH_SECRET` - Secure secret
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ORGANIZATION_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Namecheap DNS

Current DNS configuration for tsh.sale:
```
www      CNAME   cname.vercel-dns.com
staging  CNAME   cname.vercel-dns.com
_vercel  TXT     vc-domain-verify=www.tsh.sale,bc19ea0be7b464684bb8
```

## Emergency Contacts

- Vercel Status: https://vercel-status.com
- Zoho Status: https://status.zoho.com
