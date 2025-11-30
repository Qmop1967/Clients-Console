"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";

export default function VerifyRequestPage() {
  const t = useTranslations("auth");
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-full blur-xl opacity-60" />
            <Image
              src="/images/tsh-logo.jpg"
              alt="TSH - Tech Spider Hand"
              width={140}
              height={60}
              className="relative mx-auto rounded-lg"
              priority
            />
          </div>
        </div>

        {/* Verify Card */}
        <Card className="glass-auth rounded-2xl overflow-hidden animate-fade-in-up stagger-1">
          <CardHeader className="text-center pt-8 pb-4">
            {/* Email animation */}
            <div className="relative mx-auto mb-6">
              {/* Pulsing ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-blue-500/20 animate-pulse-slow" />
              </div>
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
                <Mail className="h-10 w-10 text-white animate-bounce-subtle" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{t("checkEmail")}</CardTitle>
            <CardDescription className="text-base mt-2 px-4">
              {t("verifyEmailDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-8 space-y-4">
            {/* Tips box */}
            <div className="bg-muted/50 rounded-xl p-4 mx-2">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                  <Inbox className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("checkSpamFolder")}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => router.push("/login")}
              className="gap-2 rounded-xl h-11 px-6 mt-4"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToLogin")}
            </Button>
          </CardContent>
        </Card>

        {/* Footer text */}
        <p className="text-center text-xs text-muted-foreground mt-6 animate-fade-in-up stagger-2">
          The link will expire in 24 hours
        </p>
      </div>
    </div>
  );
}
