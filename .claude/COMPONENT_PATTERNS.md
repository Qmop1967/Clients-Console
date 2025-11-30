# TSH Clients Console - Component Patterns

UI component guidelines and patterns.

---

## Component Structure

```
src/components/
├── ui/                 # shadcn/ui primitives (don't edit)
├── layout/             # Layout components
│   ├── header.tsx
│   ├── public-header.tsx
│   ├── menu-drawer.tsx
│   └── bottom-nav.tsx
├── products/           # Product components
│   ├── product-card.tsx
│   ├── product-detail-content.tsx
│   ├── public-products-content.tsx
│   ├── authenticated-products-content.tsx
│   ├── product-filters.tsx
│   ├── product-image.tsx
│   └── products-skeleton.tsx
├── dashboard/          # Dashboard components
├── orders/             # Order components
└── providers/          # Context providers
```

---

## Page Component Pattern

Server Component (Page):

```typescript
// src/app/[locale]/(main)/page-name/page.tsx
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PageContent } from '@/components/page-name/page-content';
import { PageSkeleton } from '@/components/page-name/page-skeleton';

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'pageName' });
  return { title: t('title') };
}

export default async function PageName() {
  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<PageSkeleton />}>
        <PageContent />
      </Suspense>
    </div>
  );
}
```

---

## Client Component Pattern

```typescript
// src/components/feature/component-name.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ComponentProps {
  data: DataType;
  onAction?: (id: string) => void;
}

export function ComponentName({ data, onAction }: ComponentProps) {
  const t = useTranslations('namespace');
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        {/* Content */}
      </CardContent>
    </Card>
  );
}
```

---

## Loading Skeleton Pattern

```typescript
// src/components/feature/component-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function ComponentSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

// For lists
export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ComponentSkeleton key={i} />
      ))}
    </div>
  );
}
```

---

## Product Card Pattern

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductImage } from './product-image';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    image_url?: string;
    price: number;
    currency: string;
    inPriceList: boolean;
    stock: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations('products');

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="aspect-square relative bg-muted">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="object-cover"
        />
      </div>

      <CardContent className="p-4">
        {/* Name */}
        <h3 className="font-medium line-clamp-2 min-h-[3rem]">
          {product.name}
        </h3>

        {/* Price */}
        <div className="mt-2">
          {product.inPriceList ? (
            <span className="text-lg font-bold">
              {product.price.toLocaleString()} {product.currency}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {t('contactForPrice')}
            </span>
          )}
        </div>

        {/* Stock Badge */}
        <div className="mt-2">
          <Badge variant={product.stock > 0 ? 'default' : 'secondary'}>
            {product.stock > 0 ? t('inStock') : t('outOfStock')}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## RTL Layout Patterns

### Direction-Aware Margins/Padding

```typescript
// Use logical properties
<div className="ms-4">  {/* margin-start */}
<div className="me-4">  {/* margin-end */}
<div className="ps-4">  {/* padding-start */}
<div className="pe-4">  {/* padding-end */}
```

### RTL Variants

```typescript
// Flip icons in RTL
<ChevronRight className="h-4 w-4 rtl:rotate-180" />

// Reverse flex direction
<div className="flex rtl:flex-row-reverse">

// Reverse space
<div className="flex space-x-4 rtl:space-x-reverse">
```

### Text Alignment

```typescript
// Direction-aware alignment
<p className="text-start">  {/* Left in LTR, Right in RTL */}
<p className="text-end">    {/* Right in LTR, Left in RTL */}
```

---

## Dark Mode Patterns

```typescript
// Background
<div className="bg-background dark:bg-background">

// Text
<p className="text-foreground dark:text-foreground">

// Muted
<span className="text-muted-foreground">

// Cards
<Card className="bg-card">
```

---

## Responsive Patterns

```typescript
// Mobile-first grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Responsive padding
<div className="px-4 md:px-6 lg:px-8">

// Hide/show
<div className="hidden md:block">  {/* Show on md+ */}
<div className="md:hidden">        {/* Hide on md+ */}

// Responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl">
```

---

## Form Patterns

```typescript
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function SearchForm({ onSearch }: { onSearch: (q: string) => void }) {
  const t = useTranslations('common');
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1">
        <Label htmlFor="search" className="sr-only">
          {t('search')}
        </Label>
        <Input
          id="search"
          type="search"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Button type="submit">{t('search')}</Button>
    </form>
  );
}
```

---

## Empty State Pattern

```typescript
import { PackageOpen } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <PackageOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

---

## Error Boundary Pattern

```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h2 className="text-lg font-medium">Something went wrong</h2>
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  );
}
```

---

## Available shadcn/ui Components

```
avatar, badge, button, card, input, label,
scroll-area, select, separator, sheet,
skeleton, switch, tabs
```

Add new component:
```bash
npx shadcn@latest add [component-name]
```

---

## Component Checklist

When creating a new component:

- [ ] TypeScript types/interfaces defined
- [ ] Props properly typed
- [ ] useTranslations for all text
- [ ] RTL layout considered
- [ ] Dark mode support
- [ ] Loading state (skeleton)
- [ ] Error state handling
- [ ] Responsive design (mobile-first)
- [ ] Accessibility (aria labels, semantic HTML)
