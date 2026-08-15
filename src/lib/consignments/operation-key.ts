export interface OperationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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
