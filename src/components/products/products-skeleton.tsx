import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-full" />

      {/* Tabs */}
      <Skeleton className="h-10 w-full" />

      {/* Products Grid */}
      <div className="product-grid">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <CardContent className="p-3">
              <Skeleton className="mb-1 h-4 w-full" />
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="mb-3 h-6 w-24" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
