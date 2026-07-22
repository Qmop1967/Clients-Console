import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../../helpers";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const res = await gwFetch(`/api/client/consignments/${id}/request-topup`, {
      method: "POST",
      body: { product_id: body?.product_id || null, note: body?.note || "" },
      partnerId,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("[Request Topup Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
