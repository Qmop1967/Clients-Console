"use client";

import { cn } from "@/lib/utils/cn";

interface AnimatedLogoProps {
  className?: string;
}

// BRAND FIX 2026-07-17: previously squeezed the FULL 3-line lockup JPG
// (white background, decorative noise) into a 36×36 box — unreadable blue blob.
// Now renders the extracted transparent TSH mark (tsh-mark.webp, hi-res 1034×433)
// at its natural wide aspect. Static <img> keeps the LCP win from the old fix
// (no animation, no Next/Image optimizer pass).
export function AnimatedLogo({ className }: AnimatedLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/tsh-mark.webp"
      alt="TSH — شركة يد العنكبوت التقنية"
      className={cn("h-8 w-auto select-none", className)}
      draggable={false}
      decoding="async"
    />
  );
}
