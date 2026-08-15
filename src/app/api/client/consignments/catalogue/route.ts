import { NextResponse } from "next/server";
import {
  consignmentGatewayFetch,
  getConsignmentActor,
  NO_STORE_HEADERS,
} from "@/lib/consignments/server-gateway";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const actor = await getConsignmentActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, error: "Session actor token is missing or expired", code: "ACTOR_TOKEN_REQUIRED" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const response = await consignmentGatewayFetch("/api/client/consignments/catalogue", { actor });
    const payload = await response.json().catch(() => ({
      success: false,
      error: "Malformed gateway response",
    }));
    return NextResponse.json(payload, { status: response.status, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[Consignment Catalogue Proxy]", error);
    return NextResponse.json(
      { success: false, error: "Catalogue service unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
