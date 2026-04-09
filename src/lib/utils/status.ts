/**
 * Centralized status variant utilities
 * Eliminates duplication of status-to-badge-variant mapping across components
 */

// Badge variant type that matches shadcn/ui Badge variants
export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

// Invoice status variants
const INVOICE_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "secondary",
  sent: "outline",
  viewed: "outline",
  paid: "default",
  partially_paid: "warning",
  overdue: "destructive",
  void: "secondary",
};

// Order status variants
const ORDER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "secondary",
  open: "info",
  confirmed: "default",
  shipped: "info",
  delivered: "success",
  invoiced: "default",
  cancelled: "destructive",
  closed: "secondary",
};

// Payment status variants
const PAYMENT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  success: "success",
  pending: "warning",
  failed: "destructive",
  refunded: "secondary",
};

// Support ticket status variants
const TICKET_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  open: "info",
  in_progress: "warning",
  pending: "warning",
  resolved: "success",
  closed: "secondary",
};

// Priority variants
const PRIORITY_VARIANTS: Record<string, BadgeVariant> = {
  low: "secondary",
  medium: "default",
  high: "warning",
  urgent: "destructive",
  critical: "destructive",
};

// Stock status variants
const STOCK_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "destructive",
};

/**
 * Get badge variant for invoice status
 */
export function getInvoiceStatusVariant(status: string): BadgeVariant {
  return INVOICE_STATUS_VARIANTS[status?.toLowerCase()] || "secondary";
}

/**
 * Get badge variant for order status
 */
export function getOrderStatusVariant(status: string): BadgeVariant {
  return ORDER_STATUS_VARIANTS[status?.toLowerCase()] || "secondary";
}

/**
 * Get badge variant for payment status
 */
export function getPaymentStatusVariant(status: string): BadgeVariant {
  return PAYMENT_STATUS_VARIANTS[status?.toLowerCase()] || "secondary";
}

/**
 * Get badge variant for support ticket status
 */
export function getTicketStatusVariant(status: string): BadgeVariant {
  return TICKET_STATUS_VARIANTS[status?.toLowerCase()] || "secondary";
}

/**
 * Get badge variant for priority level
 */
export function getPriorityVariant(priority: string): BadgeVariant {
  return PRIORITY_VARIANTS[priority?.toLowerCase()] || "secondary";
}

/**
 * Get badge variant for stock status
 */
export function getStockStatusVariant(status: string): BadgeVariant {
  return STOCK_STATUS_VARIANTS[status?.toLowerCase()] || "secondary";
}

/**
 * Generic status variant getter - tries all status maps
 */
export function getStatusVariant(status: string): BadgeVariant {
  const normalizedStatus = status?.toLowerCase();

  return (
    INVOICE_STATUS_VARIANTS[normalizedStatus] ||
    ORDER_STATUS_VARIANTS[normalizedStatus] ||
    PAYMENT_STATUS_VARIANTS[normalizedStatus] ||
    TICKET_STATUS_VARIANTS[normalizedStatus] ||
    PRIORITY_VARIANTS[normalizedStatus] ||
    STOCK_STATUS_VARIANTS[normalizedStatus] ||
    "secondary"
  );
}

/**
 * Determine stock status from quantity
 */
export function getStockStatus(
  quantity: number,
  lowStockThreshold: number = 5
): "in_stock" | "low_stock" | "out_of_stock" {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

/**
 * Get stock badge variant from quantity
 */
export function getStockVariantFromQuantity(
  quantity: number,
  lowStockThreshold: number = 5
): BadgeVariant {
  const status = getStockStatus(quantity, lowStockThreshold);
  return getStockStatusVariant(status);
}
