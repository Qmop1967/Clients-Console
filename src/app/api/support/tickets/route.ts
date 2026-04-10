import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

const GATEWAY_URL = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
const API_KEY = process.env.API_KEY || "";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.odooPartnerId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const partnerId = session.user.odooPartnerId;
    const res = await fetch(
      `${GATEWAY_URL}/api/tickets?partner_id=${partnerId}`,
      { headers: { "X-API-Key": API_KEY }, cache: "no-store" }
    );
    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
