export type BatteryMatchConfidence = "confirmed" | "likely";

export interface BatteryActionability {
  confidence: BatteryMatchConfidence;
  actionable: boolean;
  reason_codes: string[];
}

function reasonCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((code): code is string => typeof code === "string")
    .map((code) => code.trim())
    .filter(Boolean)));
}

/**
 * Finder responses fail closed: only an explicitly confirmed, actionable
 * result may start a sale or replenishment. Older gateway shapes therefore
 * become review-only instead of silently enabling an unsafe battery match.
 */
export function normalizeBatteryActionability(value: unknown): BatteryActionability {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const confidence: BatteryMatchConfidence = row.confidence === "confirmed" ? "confirmed" : "likely";
  const reasons = reasonCodes(row.reason_codes);
  const canonicalReasonCodes = Array.isArray(row.reason_codes) &&
    row.reason_codes.every((code) => typeof code === "string" && code.trim().length > 0);
  const actionable = confidence === "confirmed" && row.actionable === true &&
    canonicalReasonCodes && reasons.length === 0;

  if (!actionable && reasons.length === 0) {
    reasons.push(confidence === "likely"
      ? "FITMENT_NOT_CONFIRMED"
      : "BATTERY_PROFILE_NOT_VERIFIED");
  }
  return { confidence, actionable, reason_codes: reasons };
}

export function mergeBatteryActionability(values: unknown[]): BatteryActionability {
  if (values.length === 0) return normalizeBatteryActionability(null);
  const normalized = values.map(normalizeBatteryActionability);
  const confidence: BatteryMatchConfidence = normalized.every((item) => item.confidence === "confirmed")
    ? "confirmed"
    : "likely";
  const merged = Array.from(new Set(normalized.flatMap((item) => item.reason_codes)));
  const actionable = confidence === "confirmed" && merged.length === 0 && normalized.every((item) => item.actionable);
  if (!actionable && merged.length === 0) {
    merged.push(confidence === "likely" ? "FITMENT_NOT_CONFIRMED" : "BATTERY_PROFILE_NOT_VERIFIED");
  }
  return { confidence, actionable, reason_codes: merged };
}

export function batteryMatchCanAct(value: unknown): boolean {
  return normalizeBatteryActionability(value).actionable;
}
