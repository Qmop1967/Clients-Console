import "server-only";

import { decodeJwt } from "jose";

export function actorTokenNeedsRefresh(
  value: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (typeof value !== "string" || !value) return true;
  try {
    const payload = decodeJwt(value);
    return typeof payload.exp !== "number" || payload.exp <= nowSeconds + 5 * 60;
  } catch {
    return true;
  }
}

