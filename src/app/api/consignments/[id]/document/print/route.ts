// GET /api/consignments/[id]/document/print — صفحة طباعة سند العهدة (HTML + auto window.print)
import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../../../helpers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;
    const { id } = await params;

    const res = await gwFetch(`/api/client/consignments/${id}/document/print`, { partnerId });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Gateway error" }));
      return NextResponse.json(data, { status: res.status });
    }
    const html = await res.text();
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    console.error("[Consignment Print Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
