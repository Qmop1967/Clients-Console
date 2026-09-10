// Gateway consignment error codes -> `consignments.*` translation keys.
// Raw gateway `message` strings must never surface to the customer.
export const CONSIGNMENT_ERROR_KEYS: Record<string, string> = {
  EXCEEDS_REPORTABLE: "errorExceedsQty",
  EXCEEDS_REPORTABLE_QTY: "errorExceedsQty",
  EXCEEDS_REMAINING: "errorExceedsQty",
  EXCEEDS_RETURNABLE: "errorExceedsQty",
  EXCEEDS_RETURNABLE_QTY: "errorExceedsQty",
  RETURN_QTY_RESERVED: "errorExceedsQty",
  RETURN_ALREADY_PENDING: "errorExceedsQty",
  PENDING_RETURN_EXISTS: "errorExceedsQty",
  INVALID_QTY: "errorInvalidQty",
  BELOW_INVOICE_PRICE: "errorPricing",
  NO_FROZEN_PRICE: "errorPricing",
  NOT_ACTIVE: "errorNotActive",
  LINE_NOT_FOUND: "errorLineNotFound",
  PRODUCT_MISMATCH: "errorLineNotFound",
  NOT_FOUND: "errorNotFound",
};

/** Extract the gateway error code from `{code}` or `{error:{code}}` payloads. */
export function consignmentErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const outer = payload as Record<string, unknown>;
  const nested = outer.error && typeof outer.error === "object"
    ? (outer.error as Record<string, unknown>)
    : {};
  return String(outer.code || nested.code || "").trim().toUpperCase();
}

export function consignmentErrorKey(payload: unknown, fallback = "errorGeneric"): string {
  return CONSIGNMENT_ERROR_KEYS[consignmentErrorCode(payload)] || fallback;
}
