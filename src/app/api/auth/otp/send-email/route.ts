import { NextRequest, NextResponse } from "next/server";
import { generateOTP, isRateLimited, storeOTP } from "@/lib/otp-store";
import { sendEmailOTP } from "@/lib/email-otp";

// Search customer in Odoo by email via Gateway
async function findCustomerByEmail(email: string): Promise<{ found: boolean; ambiguous?: boolean; partnerId?: number; phone?: string; matchedIds?: number[] }> {
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
      return { found: false, ambiguous: true, matchedIds };
    }
    if (Array.isArray(records) && records.length === 1) {
      const customer = records[0];
      const phone = customer.mobile || customer.phone || "";
      return { found: true, partnerId: customer.id, phone };
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
    const { found, phone, partnerId, ambiguous, matchedIds } = await findCustomerByEmail(cleaned);
    if (ambiguous) {
      return NextResponse.json(
        {
          error: "يوجد أكثر من حساب بهذا البريد. تواصل مع الدعم لحل الازدواج",
          errorCode: "ambiguous_email",
          matchedIds,
        },
        { status: 409 }
      );
    }
    if (!found) {
      return NextResponse.json(
        {
          error: "البريد الإلكتروني غير مسجل لدينا. تواصل مع المبيعات للتسجيل",
          errorCode: "not_found",
        },
        { status: 404 }
      );
    }

    // Generate and store OTP.
    // IMPORTANT: the key MUST match what /api/auth/otp/verify receives as its
    // "phone" field (which is either the phone number or the email address).
    // otp-store.ts normalizePhone() treats emails as-is but mangles anything
    // else (e.g. "partner:3866" would become "+partner:3866" and never match).
    const otp = generateOTP();
    const otpKey = phone || cleaned;
    storeOTP(otpKey, otp);

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
      phone: phone || undefined, // still returned for backward compatibility (ignored by new code)
      partnerId, // canonical anchor for the verify step
    });
  } catch (error) {
    console.error("[Email OTP] Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ، حاول مرة أخرى", errorCode: "server_error" },
      { status: 500 }
    );
  }
}
