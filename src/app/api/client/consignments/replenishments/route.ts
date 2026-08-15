import { NextRequest, NextResponse } from "next/server";
import {
  consignmentGatewayFetch,
  getConsignmentActor,
  NO_STORE_HEADERS,
} from "@/lib/consignments/server-gateway";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Session actor token is missing or expired", code: "ACTOR_TOKEN_REQUIRED" },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

export async function GET() {
  const actor = await getConsignmentActor();
  if (!actor) return unauthorized();

  try {
    const response = await consignmentGatewayFetch("/api/client/consignments/replenishments", { actor });
    const payload = await response.json().catch(() => ({
      success: false,
      error: "Malformed gateway response",
    }));
    return NextResponse.json(payload, { status: response.status, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[Consignment Replenishments Proxy]", error);
    return NextResponse.json(
      { success: false, error: "Replenishment service unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(request: NextRequest) {
  const actor = await getConsignmentActor();
  if (!actor) return unauthorized();

  const body = await request.json().catch(() => null) as {
    lines?: Array<{ product_id?: unknown; qty?: unknown }>;
    note?: unknown;
    idempotency_key?: unknown;
  } | null;

  const lines = Array.isArray(body?.lines) ? body.lines : [];
  const idempotencyKey = typeof body?.idempotency_key === "string"
    ? body.idempotency_key.trim()
    : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";

  if (
    lines.length < 1 ||
    lines.length > 100 ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128 ||
    lines.some((line) => !Number.isInteger(line.product_id) ||
      Number(line.product_id) <= 0 ||
      !Number.isInteger(line.qty) ||
      Number(line.qty) <= 0 ||
      Number(line.qty) > 999)
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid replenishment request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const payload = {
    lines: lines.map((line) => ({
      product_id: Number(line.product_id),
      qty: Number(line.qty),
    })),
    note,
    idempotency_key: idempotencyKey,
  };

  try {
    const response = await consignmentGatewayFetch(
      "/api/client/consignments/replenishments",
      { actor, method: "POST", body: payload, idempotencyKey },
    );
    const responsePayload = await response.json().catch(() => ({
      success: false,
      error: "Malformed gateway response",
    }));
    return NextResponse.json(responsePayload, {
      status: response.status,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("[Consignment Replenishment Mutation Proxy]", error);
    return NextResponse.json(
      { success: false, error: "Replenishment service unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
