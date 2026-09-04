// Proxy: storefront -> gateway /api/assistant/* (AI sales assistant).
// Public by design (visitors chat before login). Identity is added ONLY here, server-side:
// a logged-in NextAuth session becomes an HMAC-signed x-storefront-partner header the
// gateway verifies; nothing the browser sends can impersonate a customer.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

async function forward(req: NextRequest, path: string[]) {
  const base = process.env.API_GATEWAY_URL;
  const key = process.env.API_KEY;
  if (!base || !key) {
    return NextResponse.json(
      { success: false, code: "GATEWAY_NOT_CONFIGURED", error: "الخدمة غير متاحة" },
      { status: 503, headers: NO_STORE },
    );
  }
  const safePath = path.filter((p) => /^[a-zA-Z0-9_-]+$/.test(p));
  if (!safePath.length || safePath[0] === "admin") {
    return NextResponse.json({ success: false, error: "not found" }, { status: 404, headers: NO_STORE });
  }
  const target = `${base.replace(/\/$/, "")}/api/assistant/${safePath.join("/")}`;
  const contentType = req.headers.get("content-type") || "";
  const isMultipart = contentType.startsWith("multipart/form-data");

  const headers: Record<string, string> = { "x-api-key": key };
  // Multipart MUST carry the original content-type (with boundary) or the gateway sees no fields.
  headers["content-type"] = isMultipart ? contentType : "application/json";
  const fwd = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  if (fwd) headers["x-forwarded-for"] = fwd;
  // Session ownership proof minted by the gateway at session creation.
  const sfa = req.headers.get("x-sfa-token");
  if (sfa) headers["x-sfa-token"] = sfa;

  // Verified identity (session creation only).
  if (safePath[0] === "session" && req.method === "POST") {
    const hmacKey = process.env.STOREFRONT_ASSISTANT_HMAC_KEY || "";
    try {
      const session = await auth();
      const pid = Number((session?.user as any)?.odooPartnerId || 0);
      if (hmacKey && Number.isInteger(pid) && pid > 0) {
        const ts = Date.now();
        const mac = crypto.createHmac("sha256", hmacKey).update(`${pid}.${ts}`).digest("hex");
        headers["x-storefront-partner"] = `${pid}.${ts}.${mac}`;
      }
    } catch { /* anonymous */ }
  }

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : isMultipart ? (req.body as any) : await req.text(),
      // @ts-expect-error duplex is required by undici for streamed bodies
      duplex: req.method === "GET" ? undefined : "half",
      cache: "no-store",
      signal: AbortSignal.timeout(65_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { ...NO_STORE, "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, code: "GATEWAY_UNREACHABLE", error: "تعذر الاتصال بالمساعد" },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path);
}
