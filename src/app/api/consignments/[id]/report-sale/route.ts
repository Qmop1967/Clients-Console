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
    const body = await req.json();

    // Qty-only contract: the client never sets prices. sell_price=0 tells the
    // gateway to value the report at the line's frozen invoice price (the exact
    // amount the approval invoice will charge).
    const payload = {
      consignment_line_id: body.consignment_line_id,
      product_id: body.product_id,
      qty_sold: body.qty_sold,
      sell_price: 0,
      notes: body.notes || "",
      idempotency_key: body.idempotency_key,
    };

    if (!payload.consignment_line_id || !payload.product_id || !payload.qty_sold || !payload.idempotency_key) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const res = await gwFetch(`/api/client/consignments/${id}/report-sale`, {
      method: "POST",
      body: payload,
      partnerId,
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    console.error("[Report Sale Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
