// Proxy: storefront -> gateway /api/trader/*
// Public by design: applicants have no session yet. Rate limiting lives in the
// gateway (Redis, per-email) and in Nginx.
import { NextRequest, NextResponse } from "next/server";

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

  const target = `${base.replace(/\/$/, "")}/api/trader/${path.join("/")}`;
  const contentType = req.headers.get("content-type") || "";
  const isMultipart = contentType.startsWith("multipart/form-data");

  const headers: Record<string, string> = { "x-api-key": key };
  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  // Never forward Arabic text in headers — ByteString errors. Body only.
  // Multipart MUST carry the original content-type (with boundary) or the gateway sees no fields.
  headers["content-type"] = isMultipart ? contentType : "application/json";

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      // Multipart must stream through untouched so the boundary survives.
      body: req.method === "GET" ? undefined
        : isMultipart ? (req.body as any) : await req.text(),
      // @ts-expect-error duplex is required by undici for streamed bodies
      duplex: req.method === "GET" ? undefined : "half",
      cache: "no-store",
    });
    const payload = await res.json().catch(() => ({
      success: false, code: "BAD_GATEWAY_RESPONSE", error: "استجابة غير صالحة",
    }));
    return NextResponse.json(payload, { status: res.status, headers: NO_STORE });
  } catch (error) {
    console.error("[Trader Proxy]", error);
    return NextResponse.json(
      { success: false, code: "GATEWAY_UNREACHABLE", error: "تعذّر الاتصال بالخادم" },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}
