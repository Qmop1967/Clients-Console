import { decodeJwt } from "jose";

function normalizedId(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim();
}

/**
 * Actor tokens are signature-verified by the gateway. This local claim check
 * prevents a valid cached token for another actor from crossing sessions.
 */
export function actorTokenNeedsRefresh(
  value: unknown,
  expectedPartnerId: string | number,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const expected = normalizedId(expectedPartnerId);
  if (typeof value !== "string" || !value || !expected) return true;

  try {
    const payload = decodeJwt(value);
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds + 5 * 60) return true;
    if (normalizedId(payload.partner_id) !== expected) return true;
    if (payload.type !== "human") return true;

    const roles = [payload.role, payload.app_role]
      .filter((role): role is string => typeof role === "string")
      .map((role) => role.trim().toLowerCase());
    return roles.length === 0 || roles.some((role) => role !== "client");
  } catch {
    return true;
  }
}
