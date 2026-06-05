"use client";

import { useState, memo } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  // kept for caller compatibility; native <img> ignores it
  sizes?: string;
}

// Memoized placeholder component for fast render
const ImagePlaceholder = memo(function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-muted", className)}>
      <Package className="h-12 w-12 text-muted-foreground/50" />
    </div>
  );
});

// IMPORTANT (perf/stability): renders a NATIVE <img> pointing at the Gateway image
// URL (/api/images/{id}?size=...&v=...), which is ALREADY correctly sized. This
// deliberately BYPASSES the Next.js /_next/image optimizer, whose per-thumbnail
// sharp re-encode (24 imgs/page at w=1080 on retina) spiked memory and OOM-restarted
// tsh-clients. The Gateway + Cloudflare handle sizing/caching instead.
export const ProductImage = memo(function ProductImage({
  src,
  alt,
  className,
  priority = false,
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!src || hasError) {
    return <ImagePlaceholder className={className} />;
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchpriority: "high" } : {})}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        className={cn(
          "absolute inset-0 h-full w-full object-contain transition-opacity duration-150",
          isLoading ? "opacity-0" : "opacity-100"
        )}
      />
      {isLoading && <div className="absolute inset-0 bg-muted" />}
    </div>
  );
});

// Smaller variant for list views - native <img>, no optimizer
export const ProductImageSmall = memo(function ProductImageSmall({
  src,
  alt,
  className,
}: Omit<ProductImageProps, "priority" | "sizes">) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <Package className="h-6 w-6 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
});
