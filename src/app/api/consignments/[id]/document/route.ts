// GET /api/consignments/[id]/document — سند العهدة المخزنية (PDF inline proxy)
import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../../helpers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;
    const { id } = await params;

    const res = await gwFetch(`/api/client/consignments/${id}/document`, { partnerId });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Gateway error" }));
      return NextResponse.json(data, { status: res.status });
    }
    const pdf = await res.arrayBuffer();
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          res.headers.get("content-disposition") || `inline; filename="consignment-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    console.error("[Consignment Document Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
