"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface AnimatedLogoProps {
  className?: string;
}

// PERFORMANCE: Removed animation that caused 2-second delay and re-render during LCP window
// The animation was hurting Core Web Vitals scores (LCP, INP)
// Now shows logo immediately for faster perceived performance
export function AnimatedLogo({ className }: AnimatedLogoProps) {
  return (
    <div className={cn("relative h-9 w-9 overflow-hidden", className)}>
      {/* TSH Logo - shown immediately for best LCP */}
      <Image
        src="/images/tsh-logo.jpg"
        alt="TSH"
        fill
        className="object-contain rounded-lg"
        priority
      />
    </div>
  );
}
