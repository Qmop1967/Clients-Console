"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const t = useTranslations("common");

  useEffect(() => {
    // Log error to console in development
    console.error("Application error:", error);
  }, [error]);

  // Determine if it's a rate limit error
  const isRateLimitError =
    error.message?.includes("429") ||
    error.message?.includes("rate") ||
    error.message?.includes("exceeded") ||
    error.message?.includes("too many");

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              {isRateLimitError ? t("rateLimitTitle") : t("errorTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isRateLimitError ? t("rateLimitDescription") : t("errorDescription")}
            </p>
          </div>

          {process.env.NODE_ENV === "development" && error.digest && (
            <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
            <Button onClick={reset} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t("tryAgain")}
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                {t("goHome")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
