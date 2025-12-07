"use client";

import { useState, useEffect } from "react";
import { Monitor } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface AnimatedLogoProps {
  className?: string;
}

// Session storage key to track if animation was shown
const LOGO_ANIMATED_KEY = "tsh_logo_animated";

export function AnimatedLogo({ className }: AnimatedLogoProps) {
  const [phase, setPhase] = useState<"computer" | "logo">("logo");

  useEffect(() => {
    // Check if animation was already shown in this session
    const wasAnimated = sessionStorage.getItem(LOGO_ANIMATED_KEY);

    if (!wasAnimated) {
      setPhase("computer");

      // After 2 seconds, show the logo
      const timer = setTimeout(() => {
        setPhase("logo");
        sessionStorage.setItem(LOGO_ANIMATED_KEY, "true");
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className={cn("relative h-9 w-9 overflow-hidden", className)}>
      {/* Dancing Computer */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500",
          phase === "computer"
            ? "opacity-100 scale-100"
            : "opacity-0 scale-0"
        )}
      >
        <Monitor
          className="h-7 w-7 text-primary animate-dance"
          strokeWidth={1}
        />
      </div>

      {/* TSH Logo */}
      <div
        className={cn(
          "absolute inset-0 transition-all duration-500",
          phase === "logo"
            ? "opacity-100 scale-100"
            : "opacity-0 scale-50"
        )}
      >
        <Image
          src="/images/tsh-logo.jpg"
          alt="TSH"
          fill
          className="object-contain rounded-lg"
          priority
        />
      </div>
    </div>
  );
}
