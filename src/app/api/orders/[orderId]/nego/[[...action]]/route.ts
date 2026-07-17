import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

// Catch-all proxy for the in-app negotiation room. Forwards every /nego and
// /nego/* sub-action to the gateway state machine, injecting the app API key
// and the authenticated customer's partner id (never client-supplied).
// The gateway enforces ownership + turn + role guards; a customer key can only
// perform customer-allowed actions there.

const GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:3010";
const API_KEY = process.env.API_KEY || "";

async function forward(
  method: "GET" | "POST" | "DELETE",
  orderId: string,
  action: string[] | undefined,
  partnerId: number,
  body: unknown,
) {
  const sub = action && action.length ? `/${action.join("/")}` : "";
  const url = `${GATEWAY_URL}/api/orders/${orderId}/nego${sub}`;
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-partner-id": String(partnerId),
      },
      ...(method !== "GET" ? { body: JSON.stringify(body || {}) } : {}),
      cache: "no-store",
    });
    const data = await resp.json().catch(() => ({ success: false, message: "خطأ في الاستجابة" }));
    return NextResponse.json(data, { status: resp.status });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: "تعذّر الاتصال بالخادم: " + (e?.message || "") },
      { status: 502 },
    );
  }
}

async function requirePartner() {
  const session = await auth();
  const pid = session?.user?.odooPartnerId ? parseInt(String(session.user.odooPartnerId), 10) : 0;
  return Number.isFinite(pid) && pid > 0 ? pid : 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string; action?: string[] }> },
) {
  const partnerId = await requirePartner();
  if (!partnerId) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  const { orderId, action } = await params;
  return forward("GET", orderId, action, partnerId, null);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; action?: string[] }> },
) {
  const partnerId = await requirePartner();
  if (!partnerId) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  const { orderId, action } = await params;
  const body = await req.json().catch(() => ({}));
  return forward("POST", orderId, action, partnerId, body);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; action?: string[] }> },
) {
  const partnerId = await requirePartner();
  if (!partnerId) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  const { orderId, action } = await params;
  const body = await req.json().catch(() => ({}));
  return forward("DELETE", orderId, action, partnerId, body);
}
