# TSH Clients Console - Custom Skills

Project-specific skills to enhance Claude Code workflows for the TSH Clients Console.

## Available Skills

| Skill | Purpose | Use When |
|-------|---------|----------|
| **zoho-api** | Zoho Books/Inventory API integration | Creating API routes, debugging token/rate issues |
| **tsh-i18n** | Internationalization (EN/AR + RTL) | Adding translations, building multilingual components |
| **tsh-pricing** | Price list logic and display | Working with pricebooks, displaying prices |
| **tsh-stock** | Stock/warehouse management | Displaying stock levels, debugging stock issues |
| **tsh-deploy** | Vercel deployment workflow | Deploying, managing env vars, revalidating caches |
| **tsh-component** | UI component patterns | Creating components, RTL/dark mode support |

## How Skills Work

Skills are loaded when Claude detects relevant context. Each skill contains:

- **SKILL.md**: Instructions and code patterns
- Optional reference files for detailed documentation

## Skill Locations

```
.claude/skills/
├── zoho-api/
│   └── SKILL.md
├── tsh-i18n/
│   └── SKILL.md
├── tsh-pricing/
│   └── SKILL.md
├── tsh-stock/
│   └── SKILL.md
├── tsh-deploy/
│   └── SKILL.md
├── tsh-component/
│   └── SKILL.md
└── README.md (this file)
```

## Quick Reference

### Critical IDs (from skills)

| Entity | ID |
|--------|-----|
| Organization | `748369814` |
| WholeSale Warehouse | `2646610000000077024` |
| Consumer Price List | `2646610000049149103` |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/zoho/client.ts` | OAuth, token caching |
| `src/lib/zoho/products.ts` | Products, stock |
| `src/lib/zoho/price-lists.ts` | Price list constants |

### Deploy Command

```bash
vercel --prod --yes
```

### Revalidate Cache

```bash
curl "https://www.tsh.sale/api/revalidate?tag=all&secret=tsh-revalidate-2024"
```
