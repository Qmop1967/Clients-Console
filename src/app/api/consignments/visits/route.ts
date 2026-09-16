// GET /api/consignments/visits — زيارات الجرد والمطابقة الخاصة بالعميل
import { NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { partnerId, actorToken, error } = await getSessionPartnerId();
    if (error) return error;
    const res = await gwFetch("/api/client/consignments/visits", { partnerId, actorToken });
    const data = await res.json().catch(() => ({ error: "Gateway error" }));
    return NextResponse.json(data, { status: res.status, headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    console.error("[Consignment Visits Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
