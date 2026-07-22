import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "../helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;
    const sp = req.nextUrl.searchParams;
    const qs = new URLSearchParams();
    if (sp.get("q")) qs.set("q", sp.get("q") || "");
    if (sp.get("laptop_id")) qs.set("laptop_id", sp.get("laptop_id") || "");
    if (sp.get("source")) qs.set("source", sp.get("source") || "");
    const res = await gwFetch(`/api/client/battery-finder?${qs.toString()}`, { partnerId });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("[Finder Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
