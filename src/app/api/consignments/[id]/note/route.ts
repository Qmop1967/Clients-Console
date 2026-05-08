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

    if (!body.notes || typeof body.notes !== "string" || body.notes.trim().length === 0) {
      return NextResponse.json({ error: "Notes required" }, { status: 400 });
    }

    const res = await gwFetch(`/api/client/consignments/${id}/note`, {
      method: "POST",
      body: { notes: body.notes.substring(0, 500) },
      partnerId,
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[Add Note Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
