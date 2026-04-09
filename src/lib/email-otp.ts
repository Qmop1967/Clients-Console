// ============================================
// Email OTP Provider — via TSH Mail Server (Brevo Relay)
// ============================================

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "10.114.0.5", // TSH mail server (VPC)
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@tsh.sale";

export async function sendEmailOTP(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #059669; margin: 0;">TSH Trading</h2>
          <p style="color: #6b7280; font-size: 14px;">بوابة العملاء</p>
        </div>
        <div style="background: #f0fdf4; border: 2px solid #059669; border-radius: 12px; padding: 24px; text-align: center;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">رمز التحقق الخاص بك:</p>
          <div style="background: white; border-radius: 8px; padding: 16px; margin: 0 auto; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0 0;">صالح لمدة 10 دقائق</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">لا تشارك هذا الرمز مع أي شخص</p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
          TSH — tsh.sale
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"TSH Trading" <${EMAIL_FROM}>`,
      to: email,
      subject: `رمز التحقق: ${code}`,
      html,
    });

    console.log("[Email OTP] ✅ Sent to:", email);
    return { success: true };
  } catch (err: any) {
    console.error("[Email OTP] ❌ Failed:", err.message);
    return { success: false, error: err.message };
  }
}
