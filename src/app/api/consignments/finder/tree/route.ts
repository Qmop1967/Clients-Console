import { NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../../helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;
    const res = await gwFetch(`/api/client/battery-finder/tree`, { partnerId });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("[Finder Tree Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
