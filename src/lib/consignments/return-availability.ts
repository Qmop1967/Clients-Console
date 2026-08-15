export interface ReturnAvailabilityLine {
  x_qty_remaining?: unknown;
  reportable_qty?: unknown;
  returnable_qty?: unknown;
  pending_reported_qty?: unknown;
  pending_return_qty?: unknown;
}

function quantity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

/** Net physical quantity that can still be requested for return. */
export function consignmentReturnableQty(line: ReturnAvailabilityLine): number {
  const explicit = quantity(line.returnable_qty);
  if (explicit !== null) return explicit;

  const remaining = quantity(line.x_qty_remaining) || 0;
  const reportable = quantity(line.reportable_qty);
  const pendingSales = quantity(line.pending_reported_qty) || 0;
  const pendingReturns = quantity(line.pending_return_qty) || 0;
  const afterSales = reportable === null
    ? Math.max(0, remaining - pendingSales)
    : Math.min(remaining, reportable);
  return Math.max(0, afterSales - pendingReturns);
}
