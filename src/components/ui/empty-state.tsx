"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Package,
  ShoppingCart,
  FileText,
  Search,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./button";

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center px-4",
  {
    variants: {
      size: {
        default: "py-12 gap-4",
        sm: "py-8 gap-3",
        lg: "py-16 gap-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

// Pre-defined empty state types
const emptyStateIcons: Record<string, LucideIcon> = {
  products: Package,
  cart: ShoppingCart,
  orders: FileText,
  invoices: FileText,
  search: Search,
  default: Inbox,
};

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  type?: keyof typeof emptyStateIcons;
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "gold" | "outline";
  };
}

function EmptyState({
  className,
  size,
  type = "default",
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  const IconComponent = icon || emptyStateIcons[type] || emptyStateIcons.default;
  const iconSize = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const titleSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  const descSize = size === "lg" ? "text-base" : "text-sm";

  return (
    <div
      className={cn(emptyStateVariants({ size, className }))}
      {...props}
    >
      {/* Icon with subtle background */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-primary/10 rounded-full blur-xl" />
        <div className="relative rounded-full bg-muted p-4">
          <IconComponent
            className={cn(iconSize, "text-muted-foreground")}
            strokeWidth={1.5}
          />
        </div>
      </div>

      {/* Text content */}
      <div className="space-y-2 max-w-sm">
        <h3 className={cn("font-display font-semibold text-foreground", titleSize)}>
          {title}
        </h3>
        {description && (
          <p className={cn("text-muted-foreground", descSize)}>
            {description}
          </p>
        )}
      </div>

      {/* Action button */}
      {action && (
        <Button
          variant={action.variant || "gold"}
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-built empty states for common use cases
function EmptyCart({ onShop }: { onShop: () => void }) {
  return (
    <EmptyState
      type="cart"
      title="Your cart is empty"
      description="Looks like you haven't added any products yet. Start shopping to fill your cart."
      action={{
        label: "Browse Products",
        onClick: onShop,
        variant: "gold",
      }}
    />
  );
}

function EmptyOrders({ onShop }: { onShop: () => void }) {
  return (
    <EmptyState
      type="orders"
      title="No orders yet"
      description="You haven't placed any orders. Start shopping to see your order history here."
      action={{
        label: "Start Shopping",
        onClick: onShop,
        variant: "gold",
      }}
    />
  );
}

function EmptySearch({ query, onClear }: { query?: string; onClear: () => void }) {
  return (
    <EmptyState
      type="search"
      title="No results found"
      description={
        query
          ? `We couldn't find any results for "${query}". Try adjusting your search.`
          : "Try adjusting your search or filters to find what you're looking for."
      }
      action={{
        label: "Clear Search",
        onClick: onClear,
        variant: "outline",
      }}
    />
  );
}

function EmptyProducts() {
  return (
    <EmptyState
      type="products"
      title="No products available"
      description="There are no products to display at the moment. Please check back later."
    />
  );
}

export {
  EmptyState,
  EmptyCart,
  EmptyOrders,
  EmptySearch,
  EmptyProducts,
  emptyStateVariants,
};
