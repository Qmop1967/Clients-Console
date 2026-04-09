import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { submitReturn } from "@/lib/odoo/returns";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { order_id, reason, note } = await req.json();

    if (!order_id || !reason) {
      return NextResponse.json({ success: false, error: "order_id and reason required" }, { status: 400 });
    }

    const result = await submitReturn(parseInt(order_id), reason, note);

    if (result) {
      return NextResponse.json({ success: true, message: "Return request submitted" });
    } else {
      return NextResponse.json({ success: false, error: "Failed to submit return" }, { status: 500 });
    }
  } catch (error) {
    console.error("[API] Return submit error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
