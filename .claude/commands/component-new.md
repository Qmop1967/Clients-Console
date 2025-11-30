Create a new component in TSH Clients Console.

## Component Types

### 1. Server Component (Page)
Location: `src/app/[locale]/(main)/[page]/page.tsx`

```typescript
import { getTranslations } from 'next-intl/server';

export default async function PageName() {
  const data = await fetchData();
  return <PageContent data={data} />;
}
```

### 2. Client Component
Location: `src/components/[feature]/[name].tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface Props {
  data: DataType;
}

export function ComponentName({ data }: Props) {
  const t = useTranslations('namespace');
  return <div>{t('key')}</div>;
}
```

### 3. Loading Skeleton
Location: `src/components/[feature]/[name]-skeleton.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function ComponentSkeleton() {
  return <Skeleton className="h-8 w-48" />;
}
```

## Checklist

- [ ] TypeScript types defined
- [ ] Translations added (en + ar)
- [ ] RTL layout considered
- [ ] Loading/error states
- [ ] Responsive design

## Directory Structure

```
src/components/
├── ui/          # shadcn/ui primitives
├── layout/      # Header, nav, footer
├── products/    # Product components
├── orders/      # Order components
└── dashboard/   # Dashboard components
```

## Available shadcn/ui

```
avatar, badge, button, card, input, label,
scroll-area, select, separator, sheet,
skeleton, switch, tabs
```

Add new: `npx shadcn@latest add [name]`

## Styling Rules

1. Use Tailwind CSS (no custom CSS)
2. Mobile-first (`md:`, `lg:` for larger)
3. RTL support (`rtl:` variants)
4. Dark mode (`dark:` variants)
