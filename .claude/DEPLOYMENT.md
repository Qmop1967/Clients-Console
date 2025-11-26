# TSH Clients Console - Deployment Guide

## Deployment Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Develop   │ ──▶ │   Staging   │ ──▶ │ Production  │
│   Locally   │     │   (Auto)    │     │  (Manual)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Commands

### Deploy to Staging (Default)
```bash
cd "/Users/khaleelal-mulla/General/ Projects/tsh-clients-console"
vercel --yes
```

### Deploy to Production (Manual Only)
```bash
# ONLY after staging verification and approval
vercel --prod --yes
```

## Verification Checklist

Before promoting to production, verify on staging:

### Functionality
- [ ] Login page loads and magic link works
- [ ] Dashboard displays correctly
- [ ] Products page shows catalog
- [ ] Orders list loads
- [ ] Invoices display properly
- [ ] Payments history works
- [ ] Credit notes accessible
- [ ] Account statement generates
- [ ] Profile page editable
- [ ] Support form submits

### Internationalization
- [ ] English (en) locale works
- [ ] Arabic (ar) locale works
- [ ] RTL layout correct for Arabic
- [ ] All text translated
- [ ] Language switcher functional

### Theme
- [ ] Light mode displays correctly
- [ ] Dark mode displays correctly
- [ ] Theme toggle works
- [ ] No color contrast issues

### Responsive Design
- [ ] Mobile layout (< 640px)
- [ ] Tablet layout (640px - 1024px)
- [ ] Desktop layout (> 1024px)
- [ ] Bottom navigation on mobile
- [ ] Drawer menu works

### API Integration
- [ ] Zoho authentication working
- [ ] Products loading from Zoho
- [ ] Orders syncing correctly
- [ ] Invoices displaying
- [ ] Payments showing
- [ ] No API errors in console

### Performance
- [ ] Page load time < 3s
- [ ] No JavaScript errors
- [ ] Images loading
- [ ] No broken links

## URLs

| Environment | URL |
|-------------|-----|
| Local | http://localhost:3000 |
| Staging | https://tsh-clients-console-[hash]-tsh-03790822.vercel.app |
| Production | https://www.tsh.sale |
| Production Alt | https://tsh-clients-console.vercel.app |

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
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Namecheap DNS

Current DNS configuration for tsh.sale:
```
www      CNAME   cname.vercel-dns.com
_vercel  TXT     vc-domain-verify=www.tsh.sale,bc19ea0be7b464684bb8
```

## Emergency Contacts

- Vercel Status: https://vercel-status.com
- Zoho Status: https://status.zoho.com
