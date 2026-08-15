// Consignment proxy helper — strict session actor + gateway call.
import { NextResponse } from "next/server";
import {
  getConsignmentActor,
  NO_STORE_HEADERS,
} from "@/lib/consignments/server-gateway";

const GW = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
const KEY = process.env.API_KEY || "";

export async function getSessionPartnerId(): Promise<{
  partnerId: string;
  actorToken: string;
  error?: NextResponse;
}> {
  const actor = await getConsignmentActor();
  if (!actor) {
    return {
      partnerId: "",
      actorToken: "",
      error: NextResponse.json(
        { error: "Session actor token is missing or expired", code: "ACTOR_TOKEN_REQUIRED" },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }
  return { partnerId: actor.partnerId, actorToken: actor.actorToken };
}

export async function gwFetch(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    partnerId: string;
    actorToken: string;
    idempotencyKey?: string;
  },
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": KEY,
    "x-actor-token": opts.actorToken,
  };
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey;
    headers["x-idempotency-key"] = opts.idempotencyKey;
  }
  return fetch(GW + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
}
