import "server-only";

import { actorTokenNeedsRefresh, auth, mintActorToken } from "@/lib/auth/auth";

export interface ConsignmentActor {
  partnerId: string;
  actorToken: string;
}

interface GatewayOptions {
  actor: ConsignmentActor;
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
}

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export async function getConsignmentActor(): Promise<ConsignmentActor | null> {
  const session = await auth();
  const partnerId = String(session?.user?.odooPartnerId || "").trim();
  if (!partnerId) return null;

  const sessionUser = session?.user as ({ actorToken?: string } | undefined);
  let actorToken = sessionUser?.actorToken;
  if (actorTokenNeedsRefresh(actorToken)) {
    actorToken = await mintActorToken(partnerId, session?.user?.name || null) || undefined;
  }

  if (!actorToken || actorTokenNeedsRefresh(actorToken)) return null;
  return { partnerId, actorToken };
}

export async function consignmentGatewayFetch(
  path: string,
  options: GatewayOptions,
): Promise<Response> {
  const gateway = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
  const apiKey = process.env.API_KEY || "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "x-actor-token": options.actor.actorToken,
  };


  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
    headers["x-idempotency-key"] = options.idempotencyKey;
  }

  return fetch(gateway + path, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
}
