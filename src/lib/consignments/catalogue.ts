export type CatalogueStatus =
  | "central"
  | "unavailable"
  | "custody"
  | "pending"
  | "likely";

export interface CatalogueProduct {
  product_id: number;
  name: string;
  code: string | null;
  category: string | null;
  image_version: number | null;
  central_qty: number;
  central_available: boolean;
  available_qty: number;
  can_replenish: boolean;
  custody_qty: number;
  pending_qty: number;
  in_transit_qty: number;
  confidence: "confirmed" | "likely" | null;
  pns: string[];
  compatible_devices: string[];
  replenishment_eligible: boolean;
}

export interface ReplenishmentHistoryLine {
  product_id: number;
  name: string;
  qty: number;
}

export interface ReplenishmentHistoryItem {
  id: string;
  name: string;
  state: string;
  created_at: string | null;
  note: string | null;
  group_key: string | null;
  lines: ReplenishmentHistoryLine[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
}

function catalogueRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const outer = record(payload);
  const data = outer.data ?? outer;
  if (Array.isArray(data)) return data;
  const inner = record(data);
  for (const key of ["products", "catalogue", "items"]) {
    if (Array.isArray(inner[key])) return inner[key] as unknown[];
  }
  return [];
}

export function normalizeCatalogue(payload: unknown): CatalogueProduct[] {
  return catalogueRows(payload)
    .map((value): CatalogueProduct | null => {
      const row = record(value);
      const status = record(row.status);
      const productId = number(row.product_id ?? row.pp_id ?? row.id);
      const name = text(row.product_name ?? row.name ?? row.display_name);
      if (!Number.isInteger(productId) || productId <= 0 || !name) return null;

      const availableQty = Math.max(0, number(row.available_for_replenishment));
      const canReplenish = status.can_replenish === true &&
        status.profile_enabled === true &&
        availableQty > 0;
      const custodyQty = Math.max(0, number(
        row.custody ??
        row.custody_qty ??
        row.qty_in_custody ??
        row.customer_qty ??
        row.consignment_qty,
      ));
      const pendingQty = Math.max(0, number(
        row.pending_topup ??
        row.pending_qty ??
        row.requested_qty ??
        row.qty_pending,
      ));
      const inTransitQty = Math.max(0, number(
        row.in_transit_topup ??
        row.in_transit_qty ??
        row.qty_in_transit ??
        row.transit_qty,
      ));
      const rawConfidence = text(
        row.compatibility_confidence ??
        row.confidence,
      );

      const compatibleRaw = row.compatible_devices ?? row.compatible ?? row.models;
      const compatibleDevices = Array.isArray(compatibleRaw)
        ? compatibleRaw.map((item) => {
          if (typeof item === "string") return item.trim();
          const model = record(item);
          return [
            text(model.brand),
            text(model.family),
            text(model.model),
          ].filter(Boolean).join(" ");
        }).filter(Boolean)
        : [];

      return {
        product_id: productId,
        name,
        code: text(row.code ?? row.default_code ?? row.sku),
        category: text(row.category ?? row.category_name),
        image_version: number(row.image_version) || null,
        central_qty: availableQty,
        central_available: availableQty > 0,
        available_qty: availableQty,
        can_replenish: canReplenish,
        custody_qty: custodyQty,
        pending_qty: pendingQty,
        in_transit_qty: inTransitQty,
        confidence: rawConfidence === "confirmed" || rawConfidence === "likely"
          ? rawConfidence
          : null,
        pns: strings(row.pns ?? row.part_numbers),
        compatible_devices: compatibleDevices,
        replenishment_eligible: row.eligible === true ||
          row.replenishment_eligible === true,
      };
    })
    .filter((item): item is CatalogueProduct => item !== null);
}

export function catalogueStatuses(product: CatalogueProduct): CatalogueStatus[] {
  const statuses: CatalogueStatus[] = [];
  statuses.push(product.central_available ? "central" : "unavailable");
  if (product.custody_qty > 0) statuses.push("custody");
  if (product.pending_qty + product.in_transit_qty > 0) statuses.push("pending");
  if (product.confidence === "likely") statuses.push("likely");
  return statuses;
}

function historyRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const outer = record(payload);
  const data = outer.data ?? outer;
  if (Array.isArray(data)) return data;
  const inner = record(data);
  for (const key of ["replenishments", "requests", "items"]) {
    if (Array.isArray(inner[key])) return inner[key] as unknown[];
  }
  return [];
}

export function normalizeReplenishmentHistory(
  payload: unknown,
): ReplenishmentHistoryItem[] {
  return historyRows(payload)
    .map((value): ReplenishmentHistoryItem | null => {
      const row = record(value);
      const id = row.request_id ?? row.id;
      const name = text(row.request_name ?? row.x_name ?? row.name);
      const state = text(row.state ?? row.x_state);
      if (
        (typeof id !== "number" && typeof id !== "string") ||
        !String(id).trim() ||
        !name ||
        !state
      ) return null;

      const lineRows = Array.isArray(row.lines) ? row.lines : [];
      const lines = lineRows.map((line): ReplenishmentHistoryLine | null => {
        const item = record(line);
        const productId = number(item.product_id ?? item.pp_id);
        const qty = number(item.qty ?? item.quantity);
        if (!Number.isInteger(productId) || productId <= 0 || qty <= 0) return null;
        return {
          product_id: productId,
          name: text(item.product_name ?? item.name) || String(productId),
          qty,
        };
      }).filter((line): line is ReplenishmentHistoryLine => line !== null);

      return {
        id: String(id),
        name,
        state,
        created_at: text(
          row.x_date_requested ??
          row.created_at ??
          row.create_date ??
          row.requested_at,
        ),
        note: text(row.x_notes ?? row.note ?? row.notes),
        group_key: text(row.x_request_group_key ?? row.idempotency_key),
        lines,
      };
    })
    .filter((item): item is ReplenishmentHistoryItem => item !== null);
}
