import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { searchProductStock } from "@/lib/odoo/stock-check";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const query = req.nextUrl.searchParams.get("query") || "";

    if (query.length < 2) {
      return NextResponse.json({ products: [] });
    }

    const products = await searchProductStock(query);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[API] Stock search error:", error);
    return NextResponse.json({ products: [] }, { status: 500 });
  }
}
