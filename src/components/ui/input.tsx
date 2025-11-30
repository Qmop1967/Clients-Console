import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const inputVariants = cva(
  "flex w-full rounded-lg border bg-background px-3 text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Default - Clean with subtle focus
        default:
          "border-input shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:border-primary",
        // Premium - Gold focus ring
        premium:
          "border-input shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/50",
        // Ghost - Minimal styling
        ghost:
          "border-transparent bg-secondary focus-visible:outline-none focus-visible:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring",
        // Error state
        error:
          "border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30",
      },
      inputSize: {
        default: "h-10 py-2",
        sm: "h-8 py-1 text-xs",
        lg: "h-12 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
