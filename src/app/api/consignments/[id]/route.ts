import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;
    const { id } = await params;

    const res = await gwFetch(`/api/client/consignments/${id}`, { partnerId });
    const data = await res.json();

    // Defense in depth: strip sensitive fields even if gateway doesn't return them
    if (data?.data?.lines) {
      data.data.lines = data.data.lines.map((l: Record<string, unknown>) => {
        const { x_invoice_unit_price, x_cost, x_margin, x_cogs, ...safe } = l as any;
        return safe;
      });
    }

    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[Consignment Detail Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
