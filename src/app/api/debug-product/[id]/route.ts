import { NextRequest, NextResponse } from "next/server";
import { getProduct, getProductImageUrl } from "@/lib/odoo/products";
import { getUnifiedStock } from "@/lib/odoo/stock";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const steps: Record<string, unknown> = {};

  // Debug payloads expose internal stock and implementation details. Keep the
  // route disabled unless explicitly enabled, and never allow anonymous use.
  if (process.env.DEBUG_PRODUCT_API_ENABLED !== "true") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.odooPartnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    steps.step1 = "getProduct";
    const product = await getProduct(id);
    steps.product = product ? { id: product.item_id, name: product.name, sku: product.sku } : null;
    if (!product) return NextResponse.json({ error: "not_found", steps });

    steps.step2 = "getUnifiedStock";
    const stock = await getUnifiedStock(id, { fetchOnMiss: true, context: "debug" });
    steps.stock = stock;

    steps.step3 = "imageUrl";
    steps.imageUrl = getProductImageUrl(product);

    return NextResponse.json({ success: true, steps });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ success: false, error: err.message, stack: err.stack?.split("\n").slice(0,5), steps });
  }
}
