"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Loader2, Store, ChevronLeft, Shield } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "@/lib/firebase";

type LoginMethod = "phone" | "email";

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === "ar";

  const [method, setMethod] = useState<LoginMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notRegistered, setNotRegistered] = useState(false);

  // SMS fallback states
  const [smsFallback, setSmsFallback] = useState(false);
  const [smsStep, setSmsStep] = useState<"sending" | "code">("sending");
  const [smsCode, setSmsCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Initialize invisible reCAPTCHA
  const initRecaptcha = useCallback(() => {
    if (recaptchaVerifierRef.current) return;
    if (!recaptchaRef.current) return;
    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => { recaptchaVerifierRef.current = null; },
      });
    } catch (err) {
      console.error("reCAPTCHA init error:", err);
    }
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
      recaptchaVerifierRef.current = null;
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

      // Create NextAuth session
      const signInResult = await signIn("phone", {
        phone: data.phone,
        redirect: false,
      });

      if (signInResult?.error) {
        setError(isAr ? "خطأ بتسجيل الدخول" : "Login error");
        return;
      }

      router.push(`/${locale}/dashboard`);
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

      // Check for SMS fallback signal
      if (method === "phone" && data.fallback === "sms") {
        // WhatsApp is down — automatically switch to Firebase SMS
        setSmsFallback(true);
        setSmsStep("sending");
        setError("");
        // Trigger Firebase SMS with the same phone number
        await sendFirebaseSMS(phone.trim());
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
      router.push(`/${locale}/login/verify`);
    } catch {
      setError(isAr ? "حدث خطأ بالاتصال، حاول مرة أخرى" : "Connection error, please try again");
    } finally {
      if (!smsFallback) setLoading(false);
    }
  };

  // Reset fallback
  const resetFallback = () => {
    setSmsFallback(false);
    setSmsStep("sending");
    setSmsCode("");
    setConfirmationResult(null);
    setError("");
    recaptchaVerifierRef.current = null;
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
              src="/images/tsh-logo.jpg"
              alt="TSH Trading"
              width={120}
              height={52}
              className="relative mx-auto rounded-lg"
              priority
            />
          </div>

          <h1 className="text-base font-bold text-foreground mt-1">
            {isAr ? "شركة TSH للتجارة العامة المحدودة" : "TSH General Trading Co. Ltd."}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <span>{isAr ? "العراق — بغداد" : "Iraq — Baghdad"}</span>
            <span>🇮🇶</span>
          </p>

          <div className="mt-4 mx-auto max-w-sm relative overflow-hidden rounded-xl border border-blue-200/60 dark:border-blue-700/40">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50/50 dark:from-blue-950/50 dark:via-slate-900/50 dark:to-cyan-950/30" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
            <div className="relative px-4 py-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 tracking-wider mb-2 flex items-center justify-center gap-1.5">
                <span className="text-blue-400 dark:text-blue-500">✦</span>
                {isAr ? "منصة تجار الجملة" : "Wholesale Partners Platform"}
                <span className="text-blue-400 dark:text-blue-500">✦</span>
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-[1.7] text-center mb-3">
                {isAr
                  ? "منصة إلكترونية حصرية لشبكة وكلائنا وتجار الجملة المعتمدين في عموم العراق. نوفر لشركائنا نظاماً متكاملاً لإدارة الطلبات والمتابعة المالية بأعلى معايير الجودة والأمان."
                  : "An exclusive digital platform for our authorized wholesale partners and dealer network across Iraq. We provide our partners with an integrated system for order management and financial tracking with the highest standards of quality and security."}
              </p>
              <div className="border-t border-blue-200/40 dark:border-blue-700/30 pt-2.5">
                <p className="text-[10px] text-muted-foreground mb-1.5 text-center">
                  {isAr ? "للاستفسار والانضمام إلى شبكة وكلائنا:" : "For inquiries and joining our dealer network:"}
                </p>
                <a
                  href="https://wa.me/9647713884329"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 mx-auto w-fit px-4 py-1.5 rounded-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-colors"
                >
                  <svg className="h-3.5 w-3.5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <span className="text-xs font-medium text-green-700 dark:text-green-300" dir="ltr">+964 771 388 4329</span>
                </a>
              </div>
            </div>
          </div>
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
                  className="w-full h-12 rounded-xl text-base font-semibold bg-green-600 hover:bg-green-700 text-white transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
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
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                <p className="text-sm text-muted-foreground text-center">
                  {isAr
                    ? "الواتساب غير متاح حالياً، جاري إرسال رمز التحقق برسالة SMS..."
                    : "WhatsApp unavailable, sending SMS code..."}
                </p>
              </div>
            ) : (
              /* Normal login tabs */
              <>
                {/* Method Toggle - 2 tabs */}
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
                      <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                        {isAr
                          ? "للمزيد من الاستفسارات يرجى التواصل معنا عبر الواتساب:"
                          : "For inquiries, please contact us on WhatsApp:"}
                      </p>
                      <a
                        href="https://wa.me/9647713884329"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        +964 771 388 4329
                      </a>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold bg-green-600 hover:bg-green-700 text-white transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
