"use client";

import { useState, useEffect } from "react";
import { Monitor } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface SplashScreenProps {
  onComplete?: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"computer" | "logo" | "fadeout" | "done">("computer");

  useEffect(() => {
    // Phase 1: Dancing computer (2 seconds)
    const computerTimer = setTimeout(() => {
      setPhase("logo");
    }, 2000);

    // Phase 2: Show logo (1.5 seconds)
    const logoTimer = setTimeout(() => {
      setPhase("fadeout");
    }, 3500);

    // Phase 3: Fade out (0.5 seconds)
    const fadeoutTimer = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 4000);

    return () => {
      clearTimeout(computerTimer);
      clearTimeout(logoTimer);
      clearTimeout(fadeoutTimer);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500",
        phase === "fadeout" && "opacity-0"
      )}
    >
      {/* Dancing Computer */}
      <div
        className={cn(
          "absolute transition-all duration-500",
          phase === "computer" ? "opacity-100 scale-100" : "opacity-0 scale-50"
        )}
      >
        <div className="relative">
          {/* Computer Icon with dance animation */}
          <div className="animate-dance">
            <Monitor
              className="h-24 w-24 text-primary"
              strokeWidth={1.5}
            />
            {/* Screen glow effect */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-16 mt-[-8px] rounded-sm bg-gradient-to-br from-cyan-400 to-blue-500 opacity-80 animate-pulse" />
            </div>
          </div>
          {/* Bounce dots underneath */}
          <div className="flex justify-center gap-2 mt-4">
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce-dot" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce-dot" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce-dot" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>

      {/* TSH Logo */}
      <div
        className={cn(
          "absolute transition-all duration-700",
          phase === "logo" || phase === "fadeout"
            ? "opacity-100 scale-100"
            : "opacity-0 scale-75"
        )}
      >
        <div className="flex flex-col items-center gap-4 animate-logo-reveal">
          {/* Logo Image */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80">
            <Image
              src="/images/tsh-logo.jpg"
              alt="TSH - Tech Spider Hand"
              fill
              className="object-contain"
              priority
            />
          </div>
          {/* Loading text */}
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading...
          </p>
        </div>
      </div>
    </div>
  );
}
