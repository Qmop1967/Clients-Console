Add new translations to TSH Clients Console (English + Arabic).

## Files to Update

| Language | File | Direction |
|----------|------|-----------|
| English | `src/messages/en.json` | LTR |
| Arabic | `src/messages/ar.json` | RTL |

## Steps to Add Translation

### 1. Identify the namespace
Common namespaces: `common`, `products`, `dashboard`, `orders`, `auth`, `navigation`

### 2. Add to en.json
```json
{
  "products": {
    "newKey": "New English Text"
  }
}
```

### 3. Add to ar.json (SAME KEY)
```json
{
  "products": {
    "newKey": "النص العربي الجديد"
  }
}
```

### 4. Use in Component
```typescript
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('products');
  return <span>{t('newKey')}</span>;
}
```

## Common Patterns

### Simple string
```json
// en.json
{ "common": { "save": "Save" } }
// ar.json
{ "common": { "save": "حفظ" } }
```

### With placeholder
```json
// en.json
{ "products": { "itemCount": "{count} items" } }
// ar.json
{ "products": { "itemCount": "{count} عناصر" } }
// Usage: t('itemCount', { count: 5 })
```

## RTL Considerations

- Text flows RTL automatically
- Icons may need `rtl:rotate-180`
- Use `rtl:` Tailwind variants for directional styles

## Testing

1. Run: `npm run dev`
2. Visit: `http://localhost:3000/ar/shop`
3. Verify text and RTL layout
