const SALE_STATES = new Set([
  "reported",
  "pending_review",
  "approval_in_progress",
  "approved",
  "invoice_created",
  "picking_created",
  "finalized",
  "invoiced",
  "rejected",
  "failed_needs_review",
]);

const RETURN_STATES = new Set([
  "requested",
  "inspection",
  "approved",
  "received",
  "partial_damage",
  "rejected",
]);

export interface SaleReportAcknowledgement {
  id: number;
  reportId: number;
  consignmentId: number;
  consignmentLineId: number;
  productId: number;
  qtySold: number;
  sellPrice: number;
  totalAmount: number;
  currencyId: number;
  state: string;
  version: number;
  idempotencyKey: string;
  idempotentReplay: boolean;
}

export interface ReturnRequestAcknowledgement {
  id: number;
  returnId: number;
  consignmentId: number;
  state: string;
  version: number;
  idempotencyKey: string;
  idempotentReplay: boolean;
  lines: Array<{
    returnLineId: number;
    consignmentLineId: number;
    productId: number;
    requestedQty: number;
    requestedGoodQty: number;
    requestedDamagedQty: number;
  }>;
}

export interface SaleReportExpectation {
  consignmentId: number;
  consignmentLineId: number;
  productId: number;
  qtySold: number;
  effectiveSellPrice: number;
  currencyId: number;
  idempotencyKey: string;
}

export interface ReturnRequestExpectation {
  consignmentId: number;
  idempotencyKey: string;
  lines: Array<{
    consignmentLineId: number;
    productId: number;
    qtyReturning: number;
  }>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function positiveQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function idempotencyKey(value: unknown): string | null {
  return typeof value === "string" && value === value.trim() && value.length >= 16 && value.length <= 128
    ? value
    : null;
}

function exactCanonicalIdentity(data: Record<string, unknown>, canonicalKey: string): number | null {
  if (!Object.hasOwn(data, "id") || !Object.hasOwn(data, canonicalKey)) return null;
  const id = positiveInteger(data.id);
  const canonicalId = positiveInteger(data[canonicalKey]);
  return id && canonicalId && id === canonicalId ? canonicalId : null;
}

function amountMatchesCurrency(left: number, right: number, currencyId: number): boolean {
  const factor = currencyId === 87 ? 1 : 100;
  return Math.round(left * factor) === Math.round(right * factor);
}

function quantityMatches(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}

export function normalizeSaleReportAcknowledgement(payload: unknown): SaleReportAcknowledgement | null {
  const data = record(record(payload).data);
  const reportId = exactCanonicalIdentity(data, "report_id");
  const consignmentId = positiveInteger(data.consignment_id);
  const consignmentLineId = positiveInteger(data.consignment_line_id);
  const productId = positiveInteger(data.product_id);
  const qtySold = positiveQuantity(data.qty_sold);
  const sellPrice = nonNegativeAmount(data.sell_price);
  const totalAmount = nonNegativeAmount(data.total_amount);
  const currencyId = positiveInteger(data.currency_id);
  const state = typeof data.state === "string" ? data.state : "";
  const version = positiveInteger(data.version);
  const operationKey = idempotencyKey(data.idempotency_key);
  if (!reportId || !consignmentId || !consignmentLineId || !productId || !qtySold ||
    sellPrice === null || totalAmount === null || !currencyId || !SALE_STATES.has(state) ||
    !version || !operationKey || typeof data.idempotent_replay !== "boolean") return null;
  return {
    id: reportId,
    reportId,
    consignmentId,
    consignmentLineId,
    productId,
    qtySold,
    sellPrice,
    totalAmount,
    currencyId,
    state,
    version,
    idempotencyKey: operationKey,
    idempotentReplay: data.idempotent_replay,
  };
}

export function saleReportAcknowledgementMatches(
  acknowledgement: SaleReportAcknowledgement | null,
  expected: SaleReportExpectation,
): acknowledgement is SaleReportAcknowledgement {
  return !!acknowledgement &&
    acknowledgement.consignmentId === expected.consignmentId &&
    acknowledgement.consignmentLineId === expected.consignmentLineId &&
    acknowledgement.productId === expected.productId &&
    quantityMatches(acknowledgement.qtySold, expected.qtySold) &&
    acknowledgement.currencyId === expected.currencyId &&
    amountMatchesCurrency(acknowledgement.sellPrice, expected.effectiveSellPrice, expected.currencyId) &&
    amountMatchesCurrency(
      acknowledgement.totalAmount,
      expected.effectiveSellPrice * expected.qtySold,
      expected.currencyId,
    ) &&
    acknowledgement.idempotencyKey === expected.idempotencyKey;
}

export function normalizeReturnRequestAcknowledgement(payload: unknown): ReturnRequestAcknowledgement | null {
  const data = record(record(payload).data);
  const returnId = exactCanonicalIdentity(data, "return_id");
  const consignmentId = positiveInteger(data.consignment_id);
  const state = typeof data.state === "string" ? data.state : "";
  const version = positiveInteger(data.version);
  const operationKey = idempotencyKey(data.idempotency_key);
  if (!returnId || !consignmentId || !RETURN_STATES.has(state) || !version || !operationKey ||
    typeof data.idempotent_replay !== "boolean" || !Array.isArray(data.lines)) return null;
  const lines = data.lines.map((value) => {
    const line = record(value);
    const returnLineId = positiveInteger(line.return_line_id);
    const consignmentLineId = positiveInteger(line.consignment_line_id);
    const productId = positiveInteger(line.product_id);
    const requestedQty = positiveQuantity(line.requested_qty);
    const requestedGoodQty = nonNegativeAmount(line.requested_good_qty);
    const requestedDamagedQty = nonNegativeAmount(line.requested_damaged_qty);
    return returnLineId && consignmentLineId && productId && requestedQty &&
      requestedGoodQty !== null && requestedDamagedQty !== null
      ? { returnLineId, consignmentLineId, productId, requestedQty, requestedGoodQty, requestedDamagedQty }
      : null;
  });
  if (!lines.length || lines.some((line) => line === null) ||
    new Set(lines.map((line) => line?.returnLineId)).size !== lines.length ||
    new Set(lines.map((line) => line?.consignmentLineId)).size !== lines.length) return null;
  return {
    id: returnId,
    returnId,
    consignmentId,
    state,
    version,
    idempotencyKey: operationKey,
    idempotentReplay: data.idempotent_replay,
    lines: lines as ReturnRequestAcknowledgement["lines"],
  };
}

export function returnRequestAcknowledgementMatches(
  acknowledgement: ReturnRequestAcknowledgement | null,
  expected: ReturnRequestExpectation,
): acknowledgement is ReturnRequestAcknowledgement {
  if (!acknowledgement || acknowledgement.consignmentId !== expected.consignmentId ||
    acknowledgement.idempotencyKey !== expected.idempotencyKey ||
    acknowledgement.lines.length !== expected.lines.length) return false;
  const returned = [...acknowledgement.lines].sort((left, right) => left.consignmentLineId - right.consignmentLineId);
  const requested = [...expected.lines].sort((left, right) => left.consignmentLineId - right.consignmentLineId);
  return requested.every((line, index) =>
    returned[index].consignmentLineId === line.consignmentLineId &&
    returned[index].productId === line.productId &&
    quantityMatches(returned[index].requestedQty, line.qtyReturning) &&
    quantityMatches(returned[index].requestedGoodQty, line.qtyReturning) &&
    quantityMatches(returned[index].requestedDamagedQty, 0));
}
