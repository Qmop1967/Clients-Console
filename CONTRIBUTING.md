# Contributing to TSH ERP Ecosystem

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in values
3. Install dependencies: `npm install`
4. Run development server: `npm run dev`

## Branch Strategy

- `main` / `master` — Production (deployed)
- `dev` — Development / staging
- `feat/...` — Feature branches
- `fix/...` — Bug fix branches
- `hotfix/...` — Emergency production fixes

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add customer filtering to invoices API
fix: resolve pricelist lookup for template-level rules
chore: update dependencies
docs: add API endpoint documentation
security: remove hardcoded credentials
refactor: extract order validation logic
```

## Code Standards

- TypeScript strict mode
- ESLint + Prettier (run `npm run lint` before committing)
- Arabic RTL support in all UI components
- All API responses follow `{ success, data?, error? }` pattern
- Secrets MUST be in `.env` — never hardcode

## Testing

```bash
npm run lint        # Lint check
npm run typecheck   # TypeScript check
npm run build       # Build check
```

## Deployment

Production deployments go through PM2 on the app server.
Never run `pm2 stop all` — stop individual apps only.

```bash
pm2 stop <app-name>
npm run build
pm2 start <app-name>
```
