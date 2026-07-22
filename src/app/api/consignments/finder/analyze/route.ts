import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../../helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;
    const body = await req.json();
    if (!body?.image || typeof body.image !== "string" || body.image.length > 8_000_000) {
      return NextResponse.json({ error: "Invalid image" }, { status: 422 });
    }
    const res = await gwFetch(`/api/client/battery-finder/analyze`, {
      method: "POST",
      body: { image: body.image, media_type: body.media_type || "image/jpeg" },
      partnerId,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("[Finder Analyze Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
