import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { odooSearchRead } from "@/lib/odoo/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.odooPartnerId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const partnerId = parseInt(session.user.odooPartnerId, 10);

    const orders = await odooSearchRead(
      "sale.order",
      [["partner_id", "=", partnerId], ["state", "in", ["sale", "done"]]],
      ["name", "date_order", "amount_total", "order_line"],
      { order: "date_order desc", limit: 20 }
    );

    const allLineIds = orders.flatMap((o: any) => o.order_line || []);
    const linesMap = new Map<number, any[]>();

    if (allLineIds.length > 0) {
      const lines = await odooSearchRead(
        "sale.order.line",
        [["id", "in", allLineIds]],
        ["order_id", "product_id", "product_uom_qty", "price_unit", "name"],
        { limit: 200 }
      );
      for (const l of lines as any[]) {
        const orderId = Array.isArray(l.order_id) ? l.order_id[0] : l.order_id;
        if (!linesMap.has(orderId)) linesMap.set(orderId, []);
        linesMap.get(orderId)!.push({
          id: l.id,
          product_id: Array.isArray(l.product_id) ? l.product_id[0] : l.product_id,
          product_name: Array.isArray(l.product_id) ? l.product_id[1] : l.name,
          qty: l.product_uom_qty,
          price: l.price_unit,
        });
      }
    }

    const formatted = (orders as any[]).map((o) => ({
      id: o.id,
      name: o.name,
      date: o.date_order ? o.date_order.split(" ")[0] : "",
      amount: o.amount_total || 0,
      products: linesMap.get(o.id) || [],
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
