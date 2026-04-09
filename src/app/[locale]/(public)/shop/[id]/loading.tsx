export default function ProductDetailLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Image skeleton */}
        <div className="aspect-square animate-pulse rounded-2xl bg-muted" />

        {/* Details skeleton */}
        <div className="space-y-4">
          {/* Title */}
          <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />

          {/* SKU */}
          <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />

          {/* Price */}
          <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />

          {/* Stock badge */}
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />

          {/* Description */}
          <div className="space-y-2 pt-4">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>

          {/* Add to cart button */}
          <div className="h-12 w-full animate-pulse rounded-lg bg-muted mt-6" />
        </div>
      </div>
    </div>
  );
}
