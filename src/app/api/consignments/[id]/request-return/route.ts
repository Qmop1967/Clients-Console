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

    const payload = {
      lines: body.lines,
      notes: body.notes || "",
      idempotency_key: body.idempotency_key,
    };

    if (!payload.lines || !Array.isArray(payload.lines) || payload.lines.length === 0 || !payload.idempotency_key) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const res = await gwFetch(`/api/client/consignments/${id}/request-return`, {
      method: "POST",
      body: payload,
      partnerId,
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    console.error("[Request Return Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
