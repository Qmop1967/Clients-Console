import { NextRequest, NextResponse } from "next/server";
import { getSessionPartnerId, gwFetch } from "./helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { partnerId, error } = await getSessionPartnerId();
    if (error) return error;

    const sp = req.nextUrl.searchParams;
    const state = sp.get("state") || "";
    const limit = sp.get("limit") || "50";
    const offset = sp.get("offset") || "0";

    let path = `/api/client/consignments?limit=${limit}&offset=${offset}`;
    if (state) path += `&state=${state}`;

    const res = await gwFetch(path, { partnerId });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[Consignment List Proxy]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
