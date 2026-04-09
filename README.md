# TSH Client Portal — بوابة العملاء

Customer-facing e-commerce portal for TSH Trading Company. Customers can browse products, place orders, view invoices, and manage their accounts.

**Live:** [https://tsh.sale](https://tsh.sale)

## Features

- 🛒 **Product Catalog** — Browse 469+ products with pricing and images
- 📦 **Order Placement** — Shopping cart + checkout flow
- 🧾 **My Orders** — Track order status and history
- 💰 **Account Statement** — View balance, invoices, payments
- 🔐 **Phone OTP Auth** — WhatsApp-based OTP + optional WebAuthn biometric
- 🌐 **Bilingual** — Arabic (RTL) + English
- 📱 **Mobile-First** — Responsive design with bottom navigation

## Stack

- **Framework:** Next.js 15 + React 19
- **Language:** TypeScript
- **Auth:** NextAuth v5 + Phone OTP + WebAuthn
- **Styling:** Tailwind CSS + Radix UI
- **Cache:** Upstash Redis
- **Validation:** Zod
- **Monitoring:** Sentry
- **Process Manager:** PM2

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Qmop1967/tsh-clients.git
cd tsh-clients

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env — see Environment Variables below

# 4. Development
npm run dev

# 5. Production
npm run build && npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | ✅ | Server port (default: 3002) |
| `NEXT_PUBLIC_API_URL` | ✅ | API Gateway URL |
| `NEXTAUTH_URL` | ✅ | Public app URL |
| `NEXTAUTH_SECRET` | ✅ | NextAuth encryption secret |
| `AUTH_SECRET` | ✅ | Auth signing secret |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis token |
| `SENTRY_DSN` | ⬚ | Sentry error tracking DSN |
| `SENTRY_AUTH_TOKEN` | ⬚ | Sentry auth token |

## Scripts

```bash
npm run dev         # Development server
npm run build       # Production build
npm start           # Start production
npm run lint        # ESLint check
npm run typecheck   # TypeScript check
npm run analyze     # Bundle analyzer
```

## Key Pages

| Route | Description |
|-------|-------------|
| `/ar` | Home page (Arabic) |
| `/ar/shop` | Product catalog |
| `/ar/shop/[id]` | Product detail |
| `/ar/cart` | Shopping cart |
| `/ar/checkout` | Checkout flow |
| `/ar/orders` | My orders |
| `/ar/orders/[id]` | Order detail |
| `/ar/account` | Account settings |
| `/ar/statement` | Account statement |

## Security

- ✅ HSTS (Strict-Transport-Security)
- ✅ Idempotency keys on checkout (60s dedup)
- ✅ Zod validation on all API inputs
- ✅ IDOR protection on order/invoice access
- ✅ OTP rate limiting (5 attempts / 15 min)
- ✅ JWT with jose library
- ✅ Sentry error monitoring

## Build & Deploy

```bash
pm2 stop tsh-clients-console
npm run build
pm2 start tsh-clients-console
```

## License

Private — TSH Trading Company
