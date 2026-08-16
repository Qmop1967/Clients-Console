export interface OperationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaleOneTarget {
  consignmentId: number;
  lineId: number;
  productId: number;
  effectiveSellPrice: number;
  currencyId: number;
}

export interface SaleOneAttempt extends Readonly<SaleOneTarget> {
  operationStorageKey: string;
}

export type SaleQuantitySnapshot = Record<number, number>;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function mutationOperationStorageKey(namespace: string, identity: unknown): string {
  return `tsh:consignment-operation:v1:${namespace}:${stableHash(JSON.stringify(identity))}`;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function nonNegativeNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

/** Freeze the exact custody allocation selected when the user taps Sell. */
export function createSaleOneAttempt(target: SaleOneTarget): SaleOneAttempt {
  const attempt = {
    consignmentId: positiveInteger(target.consignmentId, "consignmentId"),
    lineId: positiveInteger(target.lineId, "lineId"),
    productId: positiveInteger(target.productId, "productId"),
    effectiveSellPrice: nonNegativeNumber(target.effectiveSellPrice, "effectiveSellPrice"),
    currencyId: positiveInteger(target.currencyId, "currencyId"),
  };
  return Object.freeze({
    ...attempt,
    operationStorageKey: mutationOperationStorageKey("sale-one", {
      ...attempt,
      qty: 1,
    }),
  });
}

/** Remove only optimistic units that a newer server snapshot has acknowledged. */
export function reconcileOptimisticSaleCounts(
  optimistic: SaleQuantitySnapshot,
  previousServer: SaleQuantitySnapshot,
  nextServer: SaleQuantitySnapshot,
): SaleQuantitySnapshot {
  let changed = false;
  const next: SaleQuantitySnapshot = {};
  for (const [rawLineId, rawCount] of Object.entries(optimistic)) {
    const lineId = Number(rawLineId);
    if (!Object.hasOwn(nextServer, lineId)) {
      changed = true;
      continue;
    }
    const acknowledged = Math.max(0, Number(previousServer[lineId] || 0) - Number(nextServer[lineId] || 0));
    const remaining = Math.max(0, Number(rawCount || 0) - acknowledged);
    if (remaining > 0) next[lineId] = remaining;
    if (remaining !== rawCount) changed = true;
  }
  return changed ? next : optimistic;
}

export function getOrCreateMutationKey(
  storage: OperationStorage,
  storageKey: string,
  create: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const existing = storage.getItem(storageKey);
  if (existing && existing.length >= 16) return existing;
  const next = create();
  if (!next || next.length < 16) throw new Error("Secure operation key unavailable");
  storage.setItem(storageKey, next);
  return next;
}

export function clearMutationKey(storage: OperationStorage, storageKey: string): void {
  storage.removeItem(storageKey);
}

const DEFINITE_MUTATION_CODES = new Set([
  "NOT_ACTIVE",
  "EXCEEDS_REPORTABLE",
  "EXCEEDS_REPORTABLE_QTY",
  "EXCEEDS_REMAINING",
  "EXCEEDS_RETURNABLE",
  "EXCEEDS_RETURNABLE_QTY",
  "RETURN_ALREADY_PENDING",
  "PENDING_RETURN_EXISTS",
  "INVALID_QTY",
  "LINE_NOT_FOUND",
  "PRODUCT_MISMATCH",
  "NOT_FOUND",
  "IDEMPOTENCY_PAYLOAD_MISMATCH",
]);

export function isConfirmedMutationFailure(status: number, payload?: unknown): boolean {
  if (status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status)) return true;
  if (status !== 409 || !payload || typeof payload !== "object") return false;
  const outer = payload as Record<string, unknown>;
  const nested = outer.error && typeof outer.error === "object"
    ? outer.error as Record<string, unknown>
    : {};
  const code = String(outer.code || nested.code || "").trim().toUpperCase();
  return DEFINITE_MUTATION_CODES.has(code);
}
