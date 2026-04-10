import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

const GATEWAY_URL = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
const API_KEY = process.env.API_KEY || "";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.odooPartnerId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, priority, order_id, products, description, diagnosis, item_location } = body;

    if (!type || !description) {
      return NextResponse.json({ success: false, error: "type and description required" }, { status: 400 });
    }

    const partnerId = parseInt(session.user.odooPartnerId, 10);

    // 1. Create ticket via gateway
    const ticketRes = await fetch(`${GATEWAY_URL}/api/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({
        type,
        priority: priority || "normal",
        partner_id: partnerId,
        order_id: order_id || undefined,
        products: products || [],
        description,
        source: "customer",
      }),
    });
    const ticketData = await ticketRes.json();

    if (!ticketData.success) {
      return NextResponse.json({ success: false, error: ticketData.error }, { status: 500 });
    }

    const ticketId = ticketData.data.id;

    // 2. Update diagnosis + location if provided
    if (diagnosis || item_location) {
      await fetch(`${GATEWAY_URL}/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          ...(diagnosis ? { diagnosis } : {}),
          ...(item_location ? { item_location: item_location } : {}),
        }),
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: ticketId, name: ticketData.data.name },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
