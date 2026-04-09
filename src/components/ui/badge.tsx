import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Default - Primary color
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm",
        // Secondary - Subtle gray
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        // Destructive - Muted red
        destructive:
          "border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        // Outline - Border only
        outline: "text-foreground border-border",
        // Success - Teal green (refined)
        success:
          "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        // Warning - Amber (refined)
        warning:
          "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        // Info - Blue (refined)
        info:
          "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
        // Gold - Premium accent
        gold:
          "border-transparent bg-amber-500 text-white shadow-sm dark:bg-amber-500",
        // Gold subtle - Light gold background
        "gold-subtle":
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
        // Glass - Blur effect
        glass:
          "border-white/20 bg-white/10 backdrop-blur-sm text-foreground dark:border-white/10 dark:bg-white/5",
        // Pending status
        pending:
          "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        // Confirmed status
        confirmed:
          "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        // Shipped status
        shipped:
          "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
        // Delivered status
        delivered:
          "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
