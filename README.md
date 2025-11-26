# TSH Clients Console

A production-grade Next.js 15 web application for TSH wholesale and retail clients, integrated with Zoho Books & Zoho Inventory.

**Live URL**: https://www.tsh.sale

## Features

- **Authentication**: Passwordless Magic Link login via email
- **Bilingual**: Arabic & English with RTL support
- **Products**: Browse products with stock levels and prices from Zoho
- **Orders**: View past orders and order status
- **Invoices**: Access and download invoices
- **Payments**: View payment history
- **Credit Notes**: Track available credits
- **Account Statement**: Full account transaction history
- **Support**: Submit and track support tickets
- **Dark/Light Mode**: Theme switching
- **PWA Ready**: Installable as mobile app

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + shadcn/ui
- **Authentication**: NextAuth.js with Magic Link
- **Email**: Resend
- **Internationalization**: next-intl
- **State Management**: React Server Components + SWR
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Zoho Books & Inventory API credentials
- Resend API key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/tsh-clients-console.git
cd tsh-clients-console

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Fill in your environment variables in .env.local

# Run development server
npm run dev
```

### Environment Variables

See `.env.example` for all required environment variables:

- `NEXTAUTH_URL` - Your app URL
- `NEXTAUTH_SECRET` - NextAuth secret key
- `ZOHO_CLIENT_ID` - Zoho API client ID
- `ZOHO_CLIENT_SECRET` - Zoho API client secret
- `ZOHO_REFRESH_TOKEN` - Zoho refresh token
- `ZOHO_ORGANIZATION_ID` - Zoho organization ID
- `RESEND_API_KEY` - Resend email API key

## Project Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/           # Auth pages (login)
│   │   └── (main)/           # Main app pages
│   │       ├── dashboard/
│   │       ├── products/
│   │       ├── orders/
│   │       ├── invoices/
│   │       ├── payments/
│   │       ├── credit-notes/
│   │       ├── account-statement/
│   │       ├── support/
│   │       └── profile/
│   └── api/
│       ├── auth/             # NextAuth API routes
│       └── webhooks/         # Zoho webhook handlers
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── layout/               # Layout components
│   ├── dashboard/            # Dashboard components
│   ├── products/             # Products components
│   └── orders/               # Orders components
├── lib/
│   ├── auth/                 # Authentication config
│   ├── zoho/                 # Zoho API services
│   └── utils/                # Utility functions
├── i18n/                     # Internationalization config
├── messages/                 # Translation files (en.json, ar.json)
└── types/                    # TypeScript type definitions
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel Project Settings
4. Deploy

### Domain Configuration

1. Add `www.tsh.sale` in Vercel domain settings
2. Configure DNS:
   - CNAME: `www` -> `cname.vercel-dns.com`
   - Or use Vercel nameservers for automatic HTTPS

## API Integration

### Zoho Books & Inventory

The app integrates with both Zoho Books and Zoho Inventory APIs:

- **Zoho Books**: Invoices, Payments, Credit Notes, Customers
- **Zoho Inventory**: Items, Stock, Categories, Price Lists

All API calls are made server-side for security.

### Webhooks

Configure Zoho webhooks to hit `/api/webhooks/zoho` for real-time cache invalidation:

- Item updates
- Order status changes
- Invoice/Payment events
- Price list changes

## Caching Strategy

- **Products**: 5 minute cache with tag-based revalidation
- **Customer Data**: 5 minute cache per customer
- **Price Lists**: 1 hour cache
- **Categories**: 1 hour cache

Webhooks trigger on-demand revalidation for immediate updates.

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## License

Private - TSH Internal Use Only
