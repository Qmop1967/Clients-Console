// Consignment proxy helper — shared auth + gateway call
import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

const GW = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
const KEY = process.env.API_KEY || "";

export async function getSessionPartnerId(): Promise<{ partnerId: string; error?: NextResponse }> {
  const session = await auth();
  if (!session?.user) {
    return { partnerId: "", error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const pid = session.user.odooPartnerId;
  if (!pid) {
    return { partnerId: "", error: NextResponse.json({ error: "No partner linked" }, { status: 403 }) };
  }
  return { partnerId: pid };
}

export async function gwFetch(path: string, opts: { method?: string; body?: unknown; partnerId: string }): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": KEY,
    "x-partner-id": opts.partnerId,
  };
  const fetchOpts: RequestInit = {
    method: opts.method || "GET",
    headers,
    cache: "no-store",
  };
  if (opts.body) {
    fetchOpts.body = JSON.stringify(opts.body);
  }
  return fetch(`${GW}${path}`, fetchOpts);
}
