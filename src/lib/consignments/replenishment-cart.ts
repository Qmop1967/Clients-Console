export interface ReplenishmentCartLine {
  product_id: number;
  qty: number;
  name: string;
  code?: string | null;
  confidence?: "confirmed" | "likely" | null;
}

export interface ReplenishmentCartState {
  idempotencyKey: string;
  lines: ReplenishmentCartLine[];
  note: string;
  updatedAt: string;
  submissionPending: boolean;
  submissionHash: string | null;
  submittedAt: string | null;
}

export interface ReplenishmentAcknowledgement {
  id: string;
  name: string;
  state: string;
}

export interface ReplenishmentAvailability {
  product_id: number;
  can_replenish: boolean;
  available_qty: number;
}

export interface ReplenishmentHistoryMatch {
  group_key: string | null;
  lines: Array<{ product_id: number; qty: number }>;
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export function replenishmentStorageKey(partnerId: string): string {
  return "tsh:consignment-replenishment:v1:" + encodeURIComponent(partnerId);
}

export function createReplenishmentCart(idempotencyKey = uuid()): ReplenishmentCartState {
  return {
    idempotencyKey,
    lines: [],
    note: "",
    updatedAt: new Date().toISOString(),
    submissionPending: false,
    submissionHash: null,
    submittedAt: null,
  };
}

export function parseReplenishmentCart(raw: string | null): ReplenishmentCartState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ReplenishmentCartState>;
    if (
      typeof value.idempotencyKey !== "string" ||
      value.idempotencyKey.length < 16 ||
      !Array.isArray(value.lines)
    ) return null;

    const lines = value.lines
      .filter((line): line is ReplenishmentCartLine => {
        const candidate = line as ReplenishmentCartLine;
        return Number.isInteger(candidate.product_id) &&
          candidate.product_id > 0 &&
          Number.isInteger(candidate.qty) &&
          candidate.qty > 0 &&
          typeof candidate.name === "string";
      })
      .map((line) => ({ ...line, qty: Math.min(999, line.qty) }));

    return {
      idempotencyKey: value.idempotencyKey,
      lines,
      note: typeof value.note === "string" ? value.note.slice(0, 1000) : "",
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
      submissionPending: value.submissionPending === true,
      submissionHash: typeof value.submissionHash === "string" ? value.submissionHash : null,
      submittedAt: typeof value.submittedAt === "string" ? value.submittedAt : null,
    };
  } catch {
    return null;
  }
}

function editable(state: ReplenishmentCartState): boolean {
  return !state.submissionPending;
}

export function addReplenishmentLine(
  state: ReplenishmentCartState,
  line: Omit<ReplenishmentCartLine, "qty"> & { qty?: number },
  maxQty = 999,
): ReplenishmentCartState {
  if (!editable(state)) return state;
  const safeMax = Math.max(0, Math.min(999, Math.trunc(maxQty || 0)));
  if (safeMax < 1) return state;
  const wanted = Math.max(1, Math.min(safeMax, Math.trunc(line.qty || 1)));
  const existing = state.lines.find((item) => item.product_id === line.product_id);
  const lines = existing
    ? state.lines.map((item) => item.product_id === line.product_id
      ? { ...item, qty: Math.min(safeMax, item.qty + wanted) }
      : item)
    : [...state.lines, { ...line, qty: wanted }];

  return { ...state, lines, updatedAt: new Date().toISOString() };
}

export function setReplenishmentQuantity(
  state: ReplenishmentCartState,
  productId: number,
  qty: number,
  maxQty = 999,
): ReplenishmentCartState {
  if (!editable(state)) return state;
  const safeMax = Math.max(1, Math.min(999, Math.trunc(maxQty || 1)));
  const safeQty = Math.max(1, Math.min(safeMax, Math.trunc(qty || 1)));
  return {
    ...state,
    lines: state.lines.map((line) => line.product_id === productId
      ? { ...line, qty: safeQty }
      : line),
    updatedAt: new Date().toISOString(),
  };
}

export function reconcileReplenishmentCart(
  state: ReplenishmentCartState,
  availability: ReplenishmentAvailability[],
): ReplenishmentCartState {
  if (!editable(state)) return state;
  const limits = new Map(availability.map((product) => [
    product.product_id,
    product.can_replenish ? Math.max(0, Math.floor(product.available_qty)) : 0,
  ]));
  const lines = state.lines
    .filter((line) => (limits.get(line.product_id) || 0) > 0)
    .map((line) => ({
      ...line,
      qty: Math.min(line.qty, limits.get(line.product_id) || 0),
    }));
  const unchanged = lines.length === state.lines.length && lines.every((line, index) =>
    line.product_id === state.lines[index].product_id && line.qty === state.lines[index].qty,
  );
  return unchanged ? state : { ...state, lines, updatedAt: new Date().toISOString() };
}

export function replenishmentHistoryMatchesCart(
  history: ReplenishmentHistoryMatch[],
  state: ReplenishmentCartState,
): boolean {
  const matches = history.filter((item) => item.group_key === state.idempotencyKey);
  if (!matches.length) return false;
  const actual = new Map<number, number>();
  for (const item of matches) {
    for (const line of item.lines) {
      actual.set(line.product_id, (actual.get(line.product_id) || 0) + Number(line.qty || 0));
    }
  }
  const expected = new Map(state.lines.map((line) => [line.product_id, line.qty]));
  return actual.size === expected.size && [...expected].every(([productId, qty]) =>
    actual.get(productId) === qty,
  );
}

const DEFINITE_REPLENISHMENT_CODES = new Set([
  "INSUFFICIENT_STOCK",
  "INSUFFICIENT_CENTRAL_STOCK",
  "EXPOSURE_LIMIT_EXCEEDED",
  "CONSIGNMENT_LIMIT_EXCEEDED",
  "PRODUCT_NOT_ELIGIBLE",
  "INELIGIBLE_PRODUCT",
  "PROFILE_NOT_ENABLED",
  "PROFILE_DISABLED",
  "REPLENISHMENT_NOT_ENABLED",
  "NO_ACTIVE_ANCHOR",
  "ANCHOR_CURRENCY_MISMATCH",
  "MISSING_PRICE",
  "IDEMPOTENCY_PAYLOAD_MISMATCH",
  "BAD_LINE",
  "BAD_PRODUCT",
  "BAD_QUANTITY",
]);

export function isDefiniteReplenishmentFailure(status: number, payload: unknown): boolean {
  if (status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status)) return true;
  if (status !== 409 || !payload || typeof payload !== "object") return false;
  const outer = payload as Record<string, unknown>;
  const nested = outer.error && typeof outer.error === "object"
    ? outer.error as Record<string, unknown>
    : {};
  const code = String(outer.code || nested.code || "").trim().toUpperCase();
  return DEFINITE_REPLENISHMENT_CODES.has(code);
}

export function removeReplenishmentLine(
  state: ReplenishmentCartState,
  productId: number,
): ReplenishmentCartState {
  if (!editable(state)) return state;
  return {
    ...state,
    lines: state.lines.filter((line) => line.product_id !== productId),
    updatedAt: new Date().toISOString(),
  };
}

export function setReplenishmentNote(
  state: ReplenishmentCartState,
  note: string,
): ReplenishmentCartState {
  if (!editable(state)) return state;
  return { ...state, note: note.slice(0, 1000), updatedAt: new Date().toISOString() };
}

export function replenishmentSubmissionPayload(state: ReplenishmentCartState) {
  return {
    lines: [...state.lines]
      .sort((a, b) => a.product_id - b.product_id)
      .map(({ product_id, qty }) => ({ product_id, qty })),
    note: state.note.trim(),
    idempotency_key: state.idempotencyKey,
  };
}

export async function replenishmentSubmissionHash(
  state: ReplenishmentCartState,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(replenishmentSubmissionPayload(state)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function beginReplenishmentSubmission(
  state: ReplenishmentCartState,
  submissionHash: string,
): ReplenishmentCartState {
  if (state.submissionPending) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    submissionPending: true,
    submissionHash,
    submittedAt: now,
    updatedAt: now,
  };
}

export function unlockAfterConfirmedFailure(
  state: ReplenishmentCartState,
  nextIdempotencyKey = uuid(),
): ReplenishmentCartState {
  return {
    ...state,
    idempotencyKey: nextIdempotencyKey,
    submissionPending: false,
    submissionHash: null,
    submittedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function readOneAcknowledgement(value: unknown): ReplenishmentAcknowledgement | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = row.request_id ?? row.id;
  const name = row.request_name ?? row.x_name ?? row.name;
  const state = row.state ?? row.x_state;
  if (
    (typeof id !== "string" && typeof id !== "number") ||
    !String(id).trim() ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof state !== "string" ||
    !state.trim()
  ) return null;
  return { id: String(id), name: name.trim(), state: state.trim() };
}

export function readReplenishmentAcknowledgements(
  payload: unknown,
): ReplenishmentAcknowledgement[] | null {
  if (!payload || typeof payload !== "object") return null;
  const outer = payload as Record<string, unknown>;
  if (outer.success === false) return null;
  const data = outer.data ?? outer;

  let candidates: unknown[];
  if (Array.isArray(data)) {
    candidates = data;
  } else if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.replenishments)) candidates = record.replenishments;
    else if (Array.isArray(record.requests)) candidates = record.requests;
    else candidates = [record.replenishment ?? record];
  } else {
    return null;
  }

  if (!candidates.length) return null;
  const acknowledgements = candidates.map(readOneAcknowledgement);
  return acknowledgements.every((item): item is ReplenishmentAcknowledgement => item !== null)
    ? acknowledgements
    : null;
}
