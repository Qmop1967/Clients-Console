import { cn } from "@/lib/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";

const skeletonVariants = cva("rounded-md", {
  variants: {
    variant: {
      // Default - Subtle pulse
      default: "animate-pulse bg-muted",
      // Shimmer - Elegant gold-tinted shimmer
      shimmer:
        "relative overflow-hidden bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-amber-500/10 before:to-transparent",
      // Premium shimmer - More prominent gold
      "premium-shimmer":
        "relative overflow-hidden bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-amber-500/20 before:to-transparent",
      // Light - For dark backgrounds
      light: "animate-pulse bg-white/10",
    },
    size: {
      default: "",
      xs: "h-3",
      sm: "h-4",
      md: "h-6",
      lg: "h-8",
      xl: "h-12",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, size, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// Pre-built skeleton patterns for common use cases
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <Skeleton variant="shimmer" className="h-48 w-full rounded-xl" />
      <Skeleton variant="shimmer" className="h-4 w-3/4" />
      <Skeleton variant="shimmer" className="h-4 w-1/2" />
    </div>
  );
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="shimmer"
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

function SkeletonAvatar({ className }: { className?: string }) {
  return (
    <Skeleton variant="shimmer" className={cn("h-10 w-10 rounded-full", className)} />
  );
}

export { Skeleton, SkeletonCard, SkeletonText, SkeletonAvatar, skeletonVariants };
