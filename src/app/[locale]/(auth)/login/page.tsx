"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Loader2, Store, ChevronLeft, Shield, Fingerprint, X } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "@/lib/firebase";
import {
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

type LoginMethod = "phone" | "email";

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === "ar";

  // AUTH GUARD 2026-07-15: an already-authenticated visitor must NEVER see the
  // login form. Root cause of the recurring "asked to log in every time"
  // complaint: sessions were valid for 365 days, but this page ignored them —
  // bookmarks/history autocomplete pointing at /login showed the OTP form and
  // customers re-authenticated for nothing.
  const { status: sessionStatus } = useSession();
  const postLoginTarget = useCallback(() => {
    try {
      const cb = new URLSearchParams(window.location.search).get("callbackUrl") || "";
      if (cb.startsWith("/") && !cb.startsWith("//")) return cb;
    } catch { /* ignore */ }
    return `/${locale}/dashboard`;
  }, [locale]);
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    router.replace(postLoginTarget());
    router.refresh();
  }, [sessionStatus, postLoginTarget, router]);

  // Default to email while WhatsApp OTP is offline (until official WhatsApp Business API).
  // Revert to "phone" once WhatsApp is restored; the health poll below still auto-adapts.
  const [method, setMethod] = useState<LoginMethod>("email");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notRegistered, setNotRegistered] = useState(false);

  // WORKSTREAM A: one-time security re-auth notice (set when a legacy/expired
  // recovery blob was wiped by SessionRecovery). Prefills the identity.
  const [reauthNotice, setReauthNotice] = useState(false);

  // WORKSTREAM B: passkey (WebAuthn) availability + enrollment hint.
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  // On mount: consume the one-time login prefill hint + feature-detect passkeys.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tsh_login_prefill");
      if (raw) {
        const hint = JSON.parse(raw) as { method?: string; email?: string; phone?: string; reason?: string };
        if (hint?.reason === "security_reauth") {
          if (hint.email) { setEmail(hint.email); setMethod("email"); }
          else if (hint.phone) { setPhone(hint.phone); setMethod("phone"); }
          setReauthNotice(true);
        }
      }
    } catch { /* ignore */ }

    try {
      const registered = localStorage.getItem("tsh_passkey_registered") === "1";
      setPasskeyRegistered(registered);
    } catch { /* ignore */ }

    (async () => {
      try {
        if (process.env.NEXT_PUBLIC_PASSKEY_ENABLED !== "1") return; // flagged off until WebAuthn storage is real
        if (typeof window === "undefined" || !window.PublicKeyCredential) return;
        if (!browserSupportsWebAuthn()) return;
        const available = await platformAuthenticatorIsAvailable();
        setPasskeySupported(available);
      } catch { /* unsupported — leave false */ }
    })();
  }, []);

  const dismissReauthNotice = () => {
    setReauthNotice(false);
    try { localStorage.removeItem("tsh_login_prefill"); } catch { /* ignore */ }
  };

  // WORKSTREAM B: passkey login. Feature-detected; any failure (including the
  // user cancelling the biometric prompt) falls back inline to the email flow.
  const handlePasskeyLogin = async () => {
    setError("");
    setNotRegistered(false);

    // Resolve the email to authenticate: the one saved at enrollment, else the
    // email currently typed in the form.
    let pkEmail = "";
    try { pkEmail = localStorage.getItem("tsh_passkey_email") || ""; } catch { /* ignore */ }
    if (!pkEmail) pkEmail = email.trim().toLowerCase();

    if (!pkEmail || !pkEmail.includes("@")) {
      setMethod("email");
      setError(isAr
        ? "أدخل بريدك الإلكتروني للدخول بالبصمة"
        : "Enter your email to sign in with a passkey");
      return;
    }

    setPasskeyBusy(true);
    try {
      const optRes = await fetch("/api/auth/webauthn/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pkEmail }),
      });
      if (!optRes.ok) {
        // 404 = no passkey registered for this email → silent fallback to email.
        setError(isAr ? "تعذّر الدخول بالبصمة. استخدم البريد الإلكتروني." : "Passkey sign-in failed. Please use email.");
        setMethod("email");
        return;
      }
      const { options, challengeToken } = await optRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pkEmail, response: assertion, challengeToken }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok || !data?.ticket) {
        setError(isAr ? "تعذّر الدخول بالبصمة. استخدم البريد الإلكتروني." : "Passkey sign-in failed. Please use email.");
        setMethod("email");
        return;
      }

      const signInResult = await signIn("email", {
        email: data.email,
        partnerId: String(data.partnerId),
        ticket: data.ticket,
        redirect: false,
      });
      if (signInResult?.error) {
        setError(isAr ? "خطأ بتسجيل الدخول" : "Login error");
        setMethod("email");
        return;
      }

      try {
        localStorage.setItem("tsh_session_recovery", JSON.stringify({
          recoveryToken: data.recoveryToken || "",
          ts: Date.now(),
        }));
        localStorage.removeItem("tsh_login_prefill");
      } catch { /* non-critical */ }

      router.push(postLoginTarget());
      router.refresh();
    } catch (err: unknown) {
      // User cancelled the biometric prompt, or the authenticator errored.
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "AbortError") {
        setError(isAr ? "تم إلغاء المصادقة. جرّب تسجيل الدخول بالبريد الإلكتروني." : "Authentication cancelled. Try signing in with email.");
      } else {
        setError(isAr ? "تعذّر الدخول بالبصمة. استخدم البريد الإلكتروني." : "Passkey sign-in failed. Please use email.");
      }
      setMethod("email");
    } finally {
      setPasskeyBusy(false);
    }
  };

  // PHASE_H_UI_ADAPT_2026_05_02
  // WhatsApp service availability (auto-detected from /api/whatsapp/health)
  const [whatsappAvailable, setWhatsappAvailable] = useState<boolean | null>(null);
  const [whatsappReason, setWhatsappReason] = useState<string | null>(null);
  const autoSwitchedRef = useRef(false);

  // Poll WhatsApp health every 30s, auto-switch to email if degraded
  useEffect(() => {
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/whatsapp/health", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const available = !!data?.ui?.whatsapp_available;
        setWhatsappAvailable(available);
        setWhatsappReason(data?.ui?.reason || null);
        // Auto-switch to email ONCE when first detected as down (don't fight user)
        if (!available && !autoSwitchedRef.current && method === "phone" && !smsFallback) {
          autoSwitchedRef.current = true;
          setMethod("email");
        }
      } catch {
        // Silent fail — health endpoint not critical
      }
    };
    fetchHealth();
    const id = setInterval(fetchHealth, 30_000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SMS fallback states
  const [smsFallback, setSmsFallback] = useState(false);
  const [smsStep, setSmsStep] = useState<"sending" | "code">("sending");
  const [smsCode, setSmsCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // PHASE_B_RECAPTCHA_LIFECYCLE_2026_05_02
  // Initialize invisible reCAPTCHA — safely clears any stale widget first
  const initRecaptcha = useCallback(() => {
    if (!recaptchaRef.current) return;

    // Clear stale verifier (Firebase) before creating a new one
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear(); } catch {}
      recaptchaVerifierRef.current = null;
    }

    // Clear stale DOM widget (Google reCAPTCHA renders into innerHTML)
    // This prevents "reCAPTCHA has already been rendered in this element"
    try { recaptchaRef.current.innerHTML = ""; } catch {}

    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => {
          // Re-init on expiry happens lazily via initRecaptcha next call
          if (recaptchaVerifierRef.current) {
            try { recaptchaVerifierRef.current.clear(); } catch {}
          }
          recaptchaVerifierRef.current = null;
        },
      });
    } catch (err) {
      console.error("reCAPTCHA init error:", err);
      recaptchaVerifierRef.current = null;
    }
  }, []);

  // Cleanup verifier on unmount to prevent leaks across route changes
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch {}
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  // Pre-init recaptcha when page loads (needed for fallback)
  useEffect(() => {
    const timer = setTimeout(initRecaptcha, 1000);
    return () => clearTimeout(timer);
  }, [initRecaptcha]);


  // Convert Arabic/Persian digits to English
  const toEnDigits = (s: string): string =>
    s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
     .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0));

  const formatPhoneIntl = (p: string): string => {
    let digits = p.trim().replace(/[^\d]/g, "");
    if (digits.startsWith("00")) digits = digits.substring(2);
    if (digits.startsWith("964")) return "+" + digits;
    if (digits.startsWith("0")) digits = digits.substring(1);
    return "+964" + digits;
  };

  // Trigger Firebase SMS (used as fallback)
  const sendFirebaseSMS = useCallback(async (phoneNumber: string) => {
    try {
      if (!recaptchaVerifierRef.current) {
        initRecaptcha();
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!recaptchaVerifierRef.current) {
        setError(isAr ? "خطأ في التحقق، أعد تحميل الصفحة" : "Verification error, reload page");
        setLoading(false);
        return;
      }

      const intlPhone = formatPhoneIntl(phoneNumber);
      const result = await signInWithPhoneNumber(auth, intlPhone, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setSmsStep("code");
      setLoading(false);
    } catch (err: unknown) {
      console.error("Firebase SMS error:", err);
      const fbErr = err as { code?: string };
      if (fbErr.code === "auth/too-many-requests") {
        setError(isAr ? "طلبات كثيرة، حاول بعد دقائق" : "Too many requests, try later");
      } else if (fbErr.code === "auth/invalid-phone-number") {
        setError(isAr ? "رقم الهاتف غير صالح" : "Invalid phone number");
      } else {
        setError((isAr ? "فشل إرسال الرمز: " : "Failed: ") + ((err as Error)?.message || fbErr.code || "unknown"));
      }
      setSmsFallback(false);
      // Clean up verifier safely before nulling
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch {}
        recaptchaVerifierRef.current = null;
      }
      setLoading(false);
    }
  }, [initRecaptcha, isAr]);

  // Verify SMS code (fallback)
  const handleVerifySMS = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!confirmationResult) {
        setError(isAr ? "أعد المحاولة" : "Please try again");
        setSmsFallback(false);
        setLoading(false);
        return;
      }

      const credential = await confirmationResult.confirm(smsCode);
      const user = credential.user;
      const phoneNumber = user.phoneNumber || formatPhoneIntl(phone);

      // Verify with backend (check Odoo + create session)
      const res = await fetch("/api/auth/otp/verify-firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, firebaseUid: user.uid }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === "not_found" || res.status === 404) {
          setNotRegistered(true);
          setError("");
          return;
        }
        setNotRegistered(false);
        setError(data.error || (isAr ? "حدث خطأ" : "An error occurred"));
        return;
      }

      // Create NextAuth session with the server-issued single-use ticket.
      const signInResult = await signIn("phone", {
        phone: data.phone,
        ticket: data.ticket,
        redirect: false,
      });
      try {
        localStorage.setItem("tsh_session_recovery", JSON.stringify({
          recoveryToken: data.recoveryToken || "",
          ts: Date.now(),
        }));
        localStorage.removeItem("tsh_login_prefill");
      } catch { /* non-critical */ }

      if (signInResult?.error) {
        setError(isAr ? "خطأ بتسجيل الدخول" : "Login error");
        return;
      }

      router.push(postLoginTarget());
      router.refresh();
    } catch (err: unknown) {
      const fbErr = err as { code?: string };
      if (fbErr.code === "auth/invalid-verification-code") {
        setError(isAr ? "الرمز غير صحيح" : "Invalid code");
      } else if (fbErr.code === "auth/code-expired") {
        setError(isAr ? "انتهت صلاحية الرمز، أعد المحاولة" : "Code expired");
      } else {
        setError(isAr ? "فشل التحقق، حاول مرة أخرى" : "Verification failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle WhatsApp/Email OTP send
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let res: Response;

      if (method === "phone") {
        res = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim() }),
        });
      } else {
        res = await fetch("/api/auth/otp/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
      }

      const data = await res.json();

      // WhatsApp down — redirect to email login (Firebase SMS disabled: billing-not-enabled)
      if (method === "phone" && (data.fallback === "email" || data.fallback === "sms")) {
        setMethod("email");
        setError(isAr
          ? "خدمة الواتساب غير متاحة حالياً. يرجى تسجيل الدخول عبر البريد الإلكتروني."
          : "WhatsApp is currently unavailable. Please login via email."
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        if (data.errorCode === "not_found" || res.status === 404) {
          setNotRegistered(true);
          setError("");
          return;
        }
        setNotRegistered(false);
        setError(data.error || (isAr ? "حدث خطأ" : "An error occurred"));
        return;
      }

      // Normal flow — navigate to verify page
      // IMPORTANT: never store email as otp_phone — the phone Credentials provider
      // would treat it as a phone number and cross-match an unrelated partner.
      sessionStorage.removeItem("otp_phone");
      sessionStorage.removeItem("otp_email");
      sessionStorage.removeItem("otp_partner_id");
      if (method === "phone") {
        sessionStorage.setItem("otp_phone", phone.trim());
      } else {
        sessionStorage.setItem("otp_email", email.trim());
        if (data.phone) sessionStorage.setItem("otp_phone", data.phone);
        if (data.partnerId) sessionStorage.setItem("otp_partner_id", String(data.partnerId));
      }
      sessionStorage.setItem("otp_method", method);
      if (data.devOtp) sessionStorage.setItem("dev_otp", data.devOtp);
      if (data.fallback) sessionStorage.setItem("otp_fallback", "true");
      router.push(`/${locale}/login/verify${window.location.search || ""}`);
    } catch {
      setError(isAr ? "حدث خطأ بالاتصال، حاول مرة أخرى" : "Connection error, please try again");
    } finally {
      if (!smsFallback) setLoading(false);
    }
  };

  // Reset fallback — safely clear verifier before nulling
  const resetFallback = () => {
    setSmsFallback(false);
    setSmsStep("sending");
    setSmsCode("");
    setConfirmationResult(null);
    setError("");
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear(); } catch {}
      recaptchaVerifierRef.current = null;
    }
    if (recaptchaRef.current) {
      try { recaptchaRef.current.innerHTML = ""; } catch {}
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* reCAPTCHA container (invisible) */}
      <div ref={recaptchaRef} id="recaptcha-container" />



      <div className="w-full max-w-md">

        {/* Company Header */}
        <div className="text-center mb-6 animate-fade-in-up">
          <div className="relative inline-block mb-3">
            <div className="absolute -inset-3 bg-gradient-to-r from-blue-500/15 via-cyan-500/15 to-blue-500/15 rounded-full blur-xl opacity-60" />
            <Image
              src="/images/tsh-lockup.webp"
              alt="شركة يد العنكبوت التقنية — Tech Spider Hand"
              width={220}
              height={155}
              className="relative mx-auto drop-shadow-sm"
              priority
            />
          </div>

          <h1 className="text-xs font-medium text-muted-foreground mt-1">
            {isAr ? "شركة TSH للتجارة العامة المحدودة" : "TSH General Trading Co. Ltd."}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <span>{isAr ? "العراق — بغداد" : "Iraq — Baghdad"}</span>
            <span>🇮🇶</span>
          </p>

        </div>

        {/* Login Card */}
        <Card className="glass-auth rounded-2xl overflow-hidden animate-fade-in-up stagger-1">
          <CardHeader className="space-y-1 pb-4 pt-6">
            <CardTitle className="text-2xl font-bold text-center">
              {isAr ? "تسجيل الدخول" : "Sign In"}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {isAr ? "أدخل بياناتك للوصول إلى حسابك" : "Enter your credentials to access your account"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {/* WORKSTREAM A: one-time security re-auth notice */}
            {reauthNotice && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300 animate-fade-in">
                <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">
                  {isAr
                    ? "لأسباب أمنية نحتاج تأكيد الدخول لمرة واحدة فقط — بعدها يبقى حسابك مسجّلاً"
                    : "For security we need a one-time sign-in confirmation — after that you'll stay signed in."}
                </span>
                <button
                  type="button"
                  onClick={dismissReauthNotice}
                  aria-label={isAr ? "إغلاق" : "Dismiss"}
                  className="shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* SMS Fallback: Code verification */}
            {smsFallback && smsStep === "code" ? (
              <form onSubmit={handleVerifySMS} className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-400">
                    <Shield className="h-4 w-4 shrink-0" />
                    {isAr
                      ? `الواتساب غير متاح حالياً. تم إرسال رمز التحقق برسالة SMS إلى ${phone}`
                      : `WhatsApp unavailable. SMS code sent to ${phone}`}
                  </div>
                  <label htmlFor="sms-code" className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    {isAr ? "رمز التحقق" : "Verification Code"}
                  </label>
                  <Input
                    id="sms-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={smsCode}
                    onChange={(e) => setSmsCode(toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
                    className="h-12 rounded-xl text-lg tracking-[0.5em] text-center"
                    dir="ltr"
                    required
                    disabled={loading}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive animate-fade-in">
                    <span className="shrink-0">⚠️</span>
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
                  disabled={loading || smsCode.length < 6}
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

                <button
                  type="button"
                  onClick={resetFallback}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isAr ? "رجوع" : "Go back"}
                </button>
              </form>
            ) : smsFallback && smsStep === "sending" ? (
              /* SMS Fallback: Sending state */
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center">
                  {isAr
                    ? "الواتساب غير متاح حالياً، جاري إرسال رمز التحقق برسالة SMS..."
                    : "WhatsApp unavailable, sending SMS code..."}
                </p>
              </div>
            ) : (
              /* Normal login tabs */
              <>
                {/* WORKSTREAM B: passkey as PRIMARY action when already enrolled */}
                {passkeySupported && passkeyRegistered && (
                  <div className="mb-5">
                    <Button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={passkeyBusy}
                      className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
                    >
                      {passkeyBusy ? (
                        <Loader2 className="me-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Fingerprint className="me-2 h-5 w-5" />
                      )}
                      {isAr ? "الدخول بالبصمة" : "Sign in with passkey"}
                    </Button>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-2 text-muted-foreground">
                          {isAr ? "أو" : "or"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Method Toggle — hidden entirely while WhatsApp is unavailable */}
                {whatsappAvailable !== false && (
                <div className="flex gap-2 p-1 bg-muted rounded-xl mb-5">
                  <button
                    type="button"
                    onClick={() => { setMethod("phone"); setError(""); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      method === "phone"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Phone className="h-4 w-4" />
                    {isAr ? "رقم الهاتف" : "Phone"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMethod("email"); setError(""); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      method === "email"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    {isAr ? "البريد الإلكتروني" : "Email"}
                  </button>
                </div>
                )}

                <form onSubmit={handleSendOTP} className="space-y-5">
                  {method === "phone" ? (
                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {isAr ? "رقم الهاتف" : "Phone Number"}
                      </label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder={isAr ? "مثال: 07701234567" : "e.g. 07701234567"}
                        value={phone}
                        onChange={(e) => { setPhone(toEnDigits(e.target.value)); setNotRegistered(false); }}
                        className="h-12 rounded-xl text-lg tracking-wider"
                        dir="ltr"
                        required
                        disabled={loading}
                        autoComplete="tel"
                      />
                      <p className="text-xs text-muted-foreground">
                        {isAr ? "سيتم إرسال رمز التحقق على الواتساب" : "A code will be sent via WhatsApp"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {isAr ? "البريد الإلكتروني" : "Email Address"}
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={isAr ? "example@email.com" : "example@email.com"}
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setNotRegistered(false); }}
                        className="h-12 rounded-xl text-lg"
                        dir="ltr"
                        required
                        disabled={loading}
                        autoComplete="email"
                      />
                      <p className="text-xs text-muted-foreground">
                        {isAr ? "سيتم إرسال رمز التحقق على بريدك الإلكتروني" : "A code will be sent to your email"}
                      </p>
                    </div>
                  )}

                  {error && !notRegistered && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive animate-fade-in">
                      <span className="shrink-0">⚠️</span>
                      {error}
                    </div>
                  )}

                  {notRegistered && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-2xl text-center space-y-3 animate-fade-in">
                      <div className="text-3xl">🙏</div>
                      <h3 className="font-bold text-amber-800 dark:text-amber-200 text-base">
                        {isAr ? "عذراً، الزائر الكريم" : "Dear Visitor"}
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                        {isAr
                          ? "هذه المنصة خاصة بتجار الجملة المسجلين لدى شركة TSH فقط."
                          : "This platform is exclusive to registered TSH wholesale partners."}
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
                    disabled={loading || (method === "phone" ? !phone.trim() : !email.trim())}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="me-2 h-5 w-5 animate-spin" />
                        {isAr ? "جاري الإرسال..." : "Sending..."}
                      </>
                    ) : (
                      isAr ? "إرسال رمز التحقق" : "Send Verification Code"
                    )}
                  </Button>
                </form>

                {/* WORKSTREAM B: passkey as SECONDARY option when not yet enrolled */}
                {passkeySupported && !passkeyRegistered && (
                  <button
                    type="button"
                    onClick={handlePasskeyLogin}
                    disabled={passkeyBusy}
                    className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                  >
                    {passkeyBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Fingerprint className="h-4 w-4" />
                    )}
                    {isAr ? "الدخول بالبصمة" : "Sign in with passkey"}
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Wholesale partners info — for prospects */}
          <div className="animate-fade-in-up mt-6 mx-auto max-w-sm relative overflow-hidden rounded-xl border border-blue-200/60 dark:border-blue-700/40">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50/50 dark:from-blue-950/50 dark:via-slate-900/50 dark:to-cyan-950/30" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
            <div className="relative px-4 py-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 tracking-wider mb-2 flex items-center justify-center gap-1.5">
                <span className="text-blue-400 dark:text-blue-500">✦</span>
                {isAr ? "منصة تجار الجملة" : "Wholesale Partners Platform"}
                <span className="text-blue-400 dark:text-blue-500">✦</span>
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-[1.7] text-center">
                {isAr
                  ? "منصة إلكترونية حصرية لشبكة وكلائنا وتجار الجملة المعتمدين في عموم العراق. نوفر لشركائنا نظاماً متكاملاً لإدارة الطلبات والمتابعة المالية بأعلى معايير الجودة والأمان."
                  : "An exclusive digital platform for our authorized wholesale partners and dealer network across Iraq. We provide our partners with an integrated system for order management and financial tracking with the highest standards of quality and security."}
              </p>
            </div>
          </div>
      </div>
    </div>
  );
}
