// GET /api/consignments/visits/[id]/document/html — تقرير الجرد والمطابقة
import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "@/app/api/consignments/helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { partnerId, actorToken, error } = await getSessionPartnerId();
    if (error) return error;
    const { id } = await params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid visit id" }, { status: 400 });
    const res = await gwFetch(`/api/client/consignments/visits/${id}/document/html`, { partnerId, actorToken });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Gateway error" }));
      return NextResponse.json(data, { status: res.status });
    }
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...(res.headers.get("content-disposition") ? { "Content-Disposition": res.headers.get("content-disposition") as string } : {}),
      },
    });
  } catch (e: unknown) {
    console.error("[Consignment Visit html Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
