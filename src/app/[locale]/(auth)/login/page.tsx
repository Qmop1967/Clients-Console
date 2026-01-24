"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Loader2, CheckCircle, Lock, Shield, ArrowLeft, Sparkles, UserPlus, Link2, Store, ChevronLeft, Hash } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

type AuthMethod = "magic-link" | "otp";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [authMethod, setAuthMethod] = useState<AuthMethod>("magic-link");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Magic Link handler
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("resend", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError(t("magicLinkError"));
      } else {
        setSent(true);
      }
    } catch {
      setError(t("magicLinkError"));
    } finally {
      setLoading(false);
    }
  };

  // OTP Send handler
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to send code");
      }

      setOtpSent(true);
    } catch {
      setError(t("otpError"));
    } finally {
      setLoading(false);
    }
  };

  // OTP Verify handler - Use NextAuth signIn (PROPER ROOT SOLUTION)
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Use NextAuth's signIn function - this is the CORRECT way
      // NextAuth will create the session with proper cookies automatically
      const result = await signIn("otp", {
        email,
        code: otpCode,
        redirect: false,
      });

      console.log('[OTP Client] SignIn result:', result);

      if (result?.error) {
        console.error('[OTP Client] SignIn error:', result.error);
        setError(t("otpError"));
        return;
      }

      if (result?.ok) {
        // NextAuth has successfully created the session
        console.log('[OTP Client] SignIn successful, redirecting to dashboard');
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } catch (err: any) {
      console.error('[OTP Client] Exception:', err);
      setError(err.message || t("otpError"));
    } finally {
      setLoading(false);
    }
  };

  // Success state - Email/Code sent
  if (sent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <Link
          href={`/${locale}/shop`}
          className="absolute top-4 start-4 sm:top-6 sm:start-6 z-10 group flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-background transition-all duration-300"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" strokeWidth={1.5} />
          <Store className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">{tCommon("shop")}</span>
        </Link>

        <div className="w-full max-w-md animate-fade-in-up">
          <Card className="glass-auth rounded-2xl overflow-hidden">
            <CardHeader className="text-center pt-8 pb-4">
              <div className="relative mx-auto mb-6">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-green-500/20 animate-circle-expand" />
                </div>
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">
                {t("checkEmail")}
              </CardTitle>
              <CardDescription className="text-base mt-2 px-4">
                {t("checkEmailDescription", { email })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <div className="bg-muted/50 rounded-xl p-4 mb-6 mx-4">
                <p className="text-sm text-muted-foreground">
                  {t("checkSpamFolder")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSent(false);
                  setOtpSent(false);
                }}
                className="gap-2 rounded-xl h-11 px-6"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("backToLogin")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Login form
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <Link
        href={`/${locale}/shop`}
        className="absolute top-4 start-4 sm:top-6 sm:start-6 z-10 group flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-background transition-all duration-300"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" strokeWidth={1.5} />
        <Store className="h-4 w-4" strokeWidth={1.5} />
        <span className="hidden sm:inline">{tCommon("shop")}</span>
      </Link>

      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-full blur-xl opacity-60" />
            <Image
              src="/images/tsh-logo.jpg"
              alt="TSH - Tech Spider Hand"
              width={180}
              height={80}
              className="relative mx-auto rounded-lg"
              priority
            />
          </div>
          <p className="text-sm text-muted-foreground mt-4 font-medium tracking-wide">
            Clients Console
          </p>
        </div>

        {/* Login Card */}
        <Card className="glass-auth rounded-2xl overflow-hidden animate-fade-in-up stagger-1">
          <CardHeader className="space-y-1 pb-4 pt-6">
            <CardTitle className="text-2xl font-bold text-center">
              {t("welcome")}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {t("loginDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="magic-link" className="gap-1.5 text-xs">
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("magicLink")}</span>
                </TabsTrigger>
                <TabsTrigger value="otp" className="gap-1.5 text-xs">
                  <Hash className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("otpCode")}</span>
                </TabsTrigger>
              </TabsList>

              {/* Magic Link Tab */}
              <TabsContent value="magic-link">
                <form onSubmit={handleMagicLink} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="email-magic" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {t("email")}
                    </label>
                    <div className="relative group">
                      <div
                        className={`absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl opacity-0 blur transition-opacity duration-300 ${
                          focused ? "opacity-50" : "group-hover:opacity-30"
                        }`}
                      />
                      <Input
                        id="email-magic"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        className="relative h-12 rounded-xl bg-background/80 border-2 transition-all duration-300 focus:border-primary focus:ring-4 focus:ring-primary/10"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive animate-fade-in">
                      <span className="shrink-0">!</span>
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold shimmer-btn transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
                    disabled={loading || !email}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        {t("sendMagicLink")}
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* OTP Tab */}
              <TabsContent value="otp">
                {!otpSent ? (
                  <form onSubmit={handleSendOTP} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="email-otp" className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {t("email")}
                      </label>
                      <Input
                        id="email-otp"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 rounded-xl"
                        required
                        disabled={loading}
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive animate-fade-in">
                        <span className="shrink-0">!</span>
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl text-base font-semibold"
                      disabled={loading || !email}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Hash className="mr-2 h-5 w-5" />
                          {t("sendCode")}
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="otp-code" className="text-sm font-medium flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        {t("enterCode")}
                      </label>
                      <Input
                        id="otp-code"
                        type="text"
                        placeholder={t("codePlaceholder")}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-12 rounded-xl text-center text-2xl tracking-widest font-mono"
                        required
                        disabled={loading}
                        maxLength={6}
                        autoComplete="one-time-code"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive animate-fade-in">
                        <span className="shrink-0">!</span>
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl text-base font-semibold"
                      disabled={loading || otpCode.length !== 6}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-5 w-5" />
                          {t("verifyCode")}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOtpSent(false)}
                      className="w-full"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t("backToLogin")}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            {/* Info Section */}
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-800/40 shrink-0 mt-0.5">
                  <Link2 className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  {t("zohoAccountLink")}
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-800/40 shrink-0 mt-0.5">
                  <UserPlus className="h-3.5 w-3.5 text-green-600" />
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">
                  {t("newVisitorWelcome")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="flex justify-center gap-6 mt-6 animate-fade-in-up stagger-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="p-1 rounded-full bg-green-500/10">
              <Lock className="h-3 w-3 text-green-600" />
            </div>
            <span>{t("secureLogin")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="p-1 rounded-full bg-blue-500/10">
              <Shield className="h-3 w-3 text-blue-600" />
            </div>
            <span>{t("noPassword")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
