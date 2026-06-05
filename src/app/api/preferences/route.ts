// ============================================
// Customer Language Preferences API
// GET/POST /api/preferences
// x_language = UI language, x_doc_language = document language
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { odooRead, odooWrite } from "@/lib/odoo/client";

const VALID_LANGS = ["ar", "en", "ckb", "kmr", "tm"];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const partnerId = parseInt(String(session.user.odooPartnerId || "0"));
  if (!partnerId) {
    return NextResponse.json({ success: true, data: { uiLanguage: null, docLanguage: null } });
  }
  try {
    const rows = await odooRead<{ x_language?: string | false; x_doc_language?: string | false }>(
      "res.partner",
      [partnerId],
      ["x_language", "x_doc_language"]
    );
    const row = rows?.[0] || {};
    return NextResponse.json({
      success: true,
      data: {
        uiLanguage: row.x_language || null,
        docLanguage: row.x_doc_language || null,
      },
    });
  } catch (error) {
    console.error("[API] Preferences GET error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const partnerId = parseInt(String(session.user.odooPartnerId || "0"));
  if (!partnerId) {
    return NextResponse.json({ success: false, error: "No linked customer" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const values: Record<string, string> = {};
    if (body.uiLanguage) {
      if (!VALID_LANGS.includes(body.uiLanguage)) {
        return NextResponse.json({ success: false, error: "Invalid uiLanguage" }, { status: 400 });
      }
      values.x_language = body.uiLanguage;
    }
    if (body.docLanguage) {
      if (!VALID_LANGS.includes(body.docLanguage)) {
        return NextResponse.json({ success: false, error: "Invalid docLanguage" }, { status: 400 });
      }
      values.x_doc_language = body.docLanguage;
    }
    if (Object.keys(values).length === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }
    const ok = await odooWrite("res.partner", [partnerId], values);
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error("[API] Preferences POST error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
