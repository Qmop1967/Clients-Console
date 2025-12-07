import { ProductsSkeleton } from "@/components/products/products-skeleton";

export default function ShopLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-10 w-full sm:w-80 bg-muted rounded animate-pulse" />
      </div>

      {/* Products grid skeleton */}
      <ProductsSkeleton />
    </div>
  );
}
