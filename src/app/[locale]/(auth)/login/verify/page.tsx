"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, RefreshCw, CheckCircle2, Mail, MessageSquare } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export default function VerifyOTPPage() {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === "ar";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [otpMethod, setOtpMethod] = useState("phone");
  const [countdown, setCountdown] = useState(60);
  const [verified, setVerified] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const storedPhone = sessionStorage.getItem("otp_phone");
    const storedEmail = sessionStorage.getItem("otp_email");
    const storedMethod = sessionStorage.getItem("otp_method") || "phone";
    const storedDev = sessionStorage.getItem("dev_otp");
    if (!storedPhone && !storedEmail) {
      router.push(`/${locale}/login`);
      return;
    }
    if (storedPhone) setPhone(storedPhone);
    if (storedDev) setDevOtp(storedDev);
    setOtpMethod(storedMethod);

    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [locale, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Clipboard auto-detect: when user returns from WhatsApp with OTP copied
  useEffect(() => {
    if (verified || loading) return;
    
    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard?.readText) return;
        const text = await navigator.clipboard.readText();
        const digits = text.replace(/\D/g, "").slice(0, 6);
        if (digits.length === 6) {
          const newCode = digits.split("");
          setCode(newCode);
          inputRefs.current[5]?.focus();
          handleVerify(digits);
        }
      } catch {
        // Clipboard permission denied — silently ignore
      }
    };

    // Check clipboard when page regains focus (user returns from WhatsApp)
    const onFocus = () => {
      // Small delay to let clipboard update
      setTimeout(checkClipboard, 300);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        setTimeout(checkClipboard, 300);
      }
    });

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [verified, loading]);


  // Convert Arabic/Persian digits to English
  const toEnDigits = (s: string): string =>
    s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
     .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0));

  const handleInput = (index: number, value: string) => {
    const digit = toEnDigits(value).replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError("");

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === 5) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split("");
      setCode(digits);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const verifyCode = fullCode || code.join("");
    if (verifyCode.length !== 6) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone || sessionStorage.getItem("otp_email"),
          code: verifyCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || (isAr ? "الرمز غير صحيح" : "Invalid code"));
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      setVerified(true);

      // Branch on the OTP method so email logins hit the email Credentials
      // provider (which resolves the partner via partnerId) instead of being
      // squeezed through the phone lookup.
      const storedEmail = sessionStorage.getItem("otp_email") || "";
      const storedPartnerId = sessionStorage.getItem("otp_partner_id") || "";
      const signInResult = otpMethod === "email"
        ? await signIn("email", {
            email: storedEmail,
            partnerId: storedPartnerId,
            redirect: false,
          })
        : await signIn("phone", {
            phone,
            redirect: false,
          });

      if (signInResult?.error) {
        setError(isAr ? "خطأ بتسجيل الدخول. حاول مرة أخرى" : "Login error. Please try again");
        setVerified(false);
        setLoading(false);
        return;
      }

      // Store recovery data in localStorage so the session can be
      // silently restored if iOS clears the session cookie on PWA close.
      try {
        localStorage.setItem("tsh_session_recovery", JSON.stringify({
          method: otpMethod,
          ...(phone && { phone }),
          ...(storedEmail && { email: storedEmail }),
          ...(storedPartnerId && { partnerId: storedPartnerId }),
          ts: Date.now(),
        }));
      } catch { /* localStorage full — non-critical */ }

      sessionStorage.removeItem("otp_phone");
      sessionStorage.removeItem("otp_email");
      sessionStorage.removeItem("otp_partner_id");
      sessionStorage.removeItem("otp_method");
      sessionStorage.removeItem("dev_otp");

      setTimeout(() => {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }, 500);
    } catch {
      setError(isAr ? "حدث خطأ بالاتصال" : "Connection error");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError("");

    try {
      const endpoint =
        otpMethod === "email" ? "/api/auth/otp/send-email" : "/api/auth/otp/send";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          otpMethod === "email"
            ? { email: sessionStorage.getItem("otp_email") }
            : { phone }
        ),
      });

      const data = await res.json();
      if (data.devOtp) setDevOtp(data.devOtp);
      setCountdown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError(isAr ? "فشل إعادة الإرسال" : "Resend failed");
    } finally {
      setResending(false);
    }
  };

  const displayPhone = phone.startsWith("07") ? phone : phone.replace("+964", "0");

  // Dynamic icon and text based on method
  const isEmail = otpMethod === "email";
  const displayTarget = isEmail
    ? sessionStorage.getItem("otp_email") || ""
    : displayPhone;
  const sentViaText = isAr
    ? isEmail
      ? "أرسلنا رمز مكون من 6 أرقام إلى بريدك"
      : "أرسلنا رمز مكون من 6 أرقام على الواتساب"
    : isEmail
      ? "We sent a 6-digit code to your email"
      : "We sent a 6-digit code via WhatsApp";
  const backText = isAr
    ? isEmail
      ? "تغيير البريد"
      : "تغيير الرقم"
    : isEmail
      ? "Change email"
      : "Change number";

  // Icon color based on method
  const iconGradient = isEmail
    ? "from-blue-400 to-blue-600"
    : "from-green-400 to-green-600";
  const iconShadow = isEmail
    ? "shadow-blue-500/30"
    : "shadow-green-500/30";
  const iconPulseBg = isEmail
    ? "bg-blue-500/20"
    : "bg-green-500/20";

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 animate-fade-in-up">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 rounded-full blur-xl opacity-60" />
            <Image
              src="/images/tsh-logo.jpg"
              alt="TSH Trading"
              width={120}
              height={50}
              className="relative mx-auto rounded-lg"
              priority
            />
          </div>
        </div>

        {/* Verify Card */}
        <Card className="glass-auth rounded-2xl overflow-hidden animate-fade-in-up stagger-1">
          <CardHeader className="text-center pt-6 pb-3">
            {/* Dynamic Icon */}
            <div className="relative mx-auto mb-4">
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`w-16 h-16 rounded-full ${iconPulseBg} animate-pulse`}
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <div
                className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${iconGradient} shadow-lg ${iconShadow}`}
              >
                {verified ? (
                  <CheckCircle2 className="h-8 w-8 text-white" />
                ) : isEmail ? (
                  <Mail className="h-8 w-8 text-white" />
                ) : (
                  <svg
                    className="h-8 w-8 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                )}
              </div>
            </div>

            <CardTitle className="text-xl font-bold">
              {verified
                ? isAr
                  ? "تم التحقق ✅"
                  : "Verified ✅"
                : isAr
                  ? "أدخل رمز التحقق"
                  : "Enter Verification Code"}
            </CardTitle>
            <CardDescription className="text-sm mt-2 px-4">
              {verified
                ? isAr
                  ? "جاري تسجيل الدخول..."
                  : "Logging you in..."
                : (
                    <>
                      {sentViaText}
                      <br />
                      <span className="font-semibold text-foreground" dir="ltr">
                        {displayTarget}
                      </span>
                    </>
                  )}
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-6">
            {!verified && (
              <>
                {/* 6-Digit OTP Input */}
                <div
                  className="flex justify-center gap-2 sm:gap-3 mb-5"
                  dir="ltr"
                  onPaste={handlePaste}
                >
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleInput(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      disabled={loading}
                      className={`w-11 h-14 sm:w-13 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all duration-200 outline-none
                        ${
                          digit
                            ? "border-green-500 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-200"
                            : "border-gray-300 dark:border-gray-600 hover:border-green-300 bg-white dark:bg-gray-800/60 text-foreground"
                        }
                        ${loading ? "opacity-50" : ""}
                        focus:border-green-500 focus:ring-2 focus:ring-green-500/20`}
                    />
                  ))}
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center justify-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive animate-fade-in">
                    <span>⚠️</span>
                    {error}
                  </div>
                )}

                {/* Dev OTP Display */}
                {devOtp && (
                  <div className="flex flex-col items-center gap-2 p-4 mb-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl">
                    <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                      {isAr
                        ? "خدمة الواتساب متوقفة مؤقتاً — استخدم هذا الرمز:"
                        : "WhatsApp is temporarily unavailable — use this code:"}
                    </span>
                    <span
                      className="text-3xl font-bold tracking-[0.3em] text-amber-800 dark:text-amber-200"
                      dir="ltr"
                    >
                      {devOtp}
                    </span>
                  </div>
                )}

                {/* Verify Button */}
                <Button
                  onClick={() => handleVerify()}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-green-600 hover:bg-green-700 text-white transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
                  disabled={loading || code.join("").length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader2 className="me-2 h-5 w-5 animate-spin" />
                      {isAr ? "جاري التحقق..." : "Verifying..."}
                    </>
                  ) : (
                    isAr ? "تأكيد" : "Verify"
                  )}
                </Button>

                {/* Resend & Back */}
                <div className="flex items-center justify-between mt-5">
                  <button
                    onClick={() => router.push(`/${locale}/login`)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    {backText}
                  </button>

                  <button
                    onClick={handleResend}
                    disabled={countdown > 0 || resending}
                    className={`flex items-center gap-1.5 text-sm transition-colors ${
                      countdown > 0
                        ? "text-muted-foreground cursor-not-allowed"
                        : "text-green-600 hover:text-green-700 cursor-pointer"
                    }`}
                  >
                    {resending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {countdown > 0
                      ? isAr
                        ? `إعادة الإرسال (${countdown}ث)`
                        : `Resend (${countdown}s)`
                      : isAr
                        ? "إعادة الإرسال"
                        : "Resend"}
                  </button>
                </div>
              </>
            )}

            {verified && (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
