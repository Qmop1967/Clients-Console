import { NextRequest, NextResponse } from "next/server";
import { generateOTP, isRateLimited, storeOTP } from "@/lib/otp-store";
import { sendEmailOTP } from "@/lib/email-otp";

// Search customer in Odoo by email via Gateway
async function findCustomerByEmail(email: string): Promise<{ found: boolean; ambiguous?: boolean }> {
  const gatewayUrl = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
  const apiKey = process.env.API_KEY || "";

  try {
    const res = await fetch(`${gatewayUrl}/api/odoo/search_read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "res.partner",
        domain: [
          "&", "&",
          ["customer_rank", ">", 0],
          ["active", "=", true],
          ["email", "=ilike", email.toLowerCase()],
        ],
        fields: ["id", "name", "email", "phone", "mobile"],
        limit: 2,
        order: "id ASC",
      }),
    });

    const data = await res.json();
    const records = data?.data || data?.result || data || [];
    if (Array.isArray(records) && records.length > 1) {
      const matchedIds = records.map((r: any) => r.id);
      console.error("[Email OTP] AMBIGUOUS_EMAIL", email, matchedIds);
      return { found: false, ambiguous: true };
    }
    if (Array.isArray(records) && records.length === 1) {
      return { found: true };
    }
    return { found: false };
  } catch (err) {
    console.error("[Email OTP] Gateway error:", err);
    return { found: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مطلوب", errorCode: "missing_email" },
        { status: 400 }
      );
    }

    const cleaned = email.trim().toLowerCase();

    // Rate limit: 1 OTP per minute per email
    if (isRateLimited(cleaned)) {
      return NextResponse.json(
        { error: "انتظر دقيقة قبل طلب رمز جديد", errorCode: "rate_limited" },
        { status: 429 }
      );
    }

    // Check if customer exists in Odoo
    const { found, ambiguous } = await findCustomerByEmail(cleaned);
    if (!found || ambiguous) {
      // Keep the response indistinguishable from a registered account so this
      // endpoint cannot be used to enumerate TSH client emails. A dummy OTP
      // applies the same resend throttle without ever creating a session.
      storeOTP(cleaned, generateOTP());
      return NextResponse.json({
        success: true,
        message: "إذا كان البريد مسجلاً فسيصلك رمز التحقق",
      });
    }

    // Generate and store OTP.
    // Email logins are keyed only by the normalized email; no Odoo ID or phone
    const otp = generateOTP();
    storeOTP(cleaned, otp);

    // Send via Email
    const result = await sendEmailOTP(cleaned, otp);

    if (!result.success) {
      console.error("[Email OTP] Send failed:", result.error);
      return NextResponse.json(
        { error: "فشل إرسال الرمز. حاول مرة أخرى", errorCode: "send_failed" },
        { status: 500 }
      );
    }

    console.log("[Email OTP] ✅ OTP sent to:", cleaned);

    return NextResponse.json({
      success: true,
      message: "تم إرسال رمز التحقق على البريد الإلكتروني",
    });
  } catch (error) {
    console.error("[Email OTP] Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ، حاول مرة أخرى", errorCode: "server_error" },
      { status: 500 }
    );
  }
}
