import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../../helpers";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { partnerId, actorToken, error } = await getSessionPartnerId();
    if (error) return error;
    const { id } = await params;
    const body = await req.json();

    const lines: Array<{
      consignment_line_id: number;
      product_id: number;
      qty_returning: number;
    }> = Array.isArray(body.lines) ? body.lines.map((line: unknown) => {
      const row = line && typeof line === "object" ? line as Record<string, unknown> : {};
      return {
        consignment_line_id: Number(row.consignment_line_id),
        product_id: Number(row.product_id),
        qty_returning: Number(row.qty_returning),
      };
    }) : [];

    const payload = {
      lines,
      notes: body.notes || "",
      idempotency_key: body.idempotency_key,
    };

    const invalidLine = lines.some((line) =>
      !Number.isInteger(line.consignment_line_id) || line.consignment_line_id <= 0 ||
      !Number.isInteger(line.product_id) || line.product_id <= 0 ||
      !Number.isInteger(line.qty_returning) || line.qty_returning <= 0
    );
    if (
      !lines.length ||
      invalidLine ||
      typeof payload.idempotency_key !== "string" ||
      payload.idempotency_key.length < 16 ||
      payload.idempotency_key.length > 128
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const res = await gwFetch(`/api/client/consignments/${id}/request-return`, {
      method: "POST",
      body: payload,
      partnerId,
      actorToken,
      idempotencyKey: payload.idempotency_key,
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    console.error("[Request Return Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
