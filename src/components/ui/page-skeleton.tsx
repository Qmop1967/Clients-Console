import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonVariant = "list" | "detail" | "form" | "statement";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  rows?: number;
  summaryCards?: number;
}

/**
 * Shared, route-agnostic loading skeleton used by (main) route loading.tsx files.
 * Purely presentational — mirrors the app's card-based layout so the transition
 * from skeleton to real content is visually stable (no layout shift).
 */
export function PageSkeleton({
  variant = "list",
  rows = 5,
  summaryCards,
}: PageSkeletonProps) {
  const cards =
    summaryCards ?? (variant === "statement" ? 4 : variant === "detail" ? 3 : 0);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>

      {cards > 0 && (
        <div
          className={
            cards >= 4
              ? "grid grid-cols-2 lg:grid-cols-4 gap-3"
              : "grid grid-cols-1 sm:grid-cols-3 gap-3"
          }
        >
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === "form" ? (
        <div className="rounded-xl border bg-card p-6 space-y-5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-11 w-40 rounded-lg" />
        </div>
      ) : variant === "detail" ? (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-4 flex items-start justify-between gap-3"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-2 shrink-0 flex flex-col items-end">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
