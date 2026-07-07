"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
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
    <div className={cn("flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/40 via-background to-muted/40", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-primary/5">
        <Package className="h-7 w-7 text-primary/40" strokeWidth={1.5} />
      </div>
      <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/50">TSH</span>
    </div>
  );
});

// Retry-once on error: a transient gateway 404/timeout under a cold-grid burst must
// NOT pin a placeholder for the whole session (the old onError->fallback did exactly
// that). First failure schedules ONE cache-busted retry (~600ms — by then the gateway
// Redis is warm from the burst); only a second failure shows the fallback.
function useRetryOnceSrc(src: string | null | undefined) {
  const [effectiveSrc, setEffectiveSrc] = useState<string | null>(src ?? null);
  const [failed, setFailed] = useState(false);
  const retriedRef = useRef(false);

  useEffect(() => {
    setEffectiveSrc(src ?? null);
    setFailed(false);
    retriedRef.current = false;
  }, [src]);

  const onError = useCallback(() => {
    if (!retriedRef.current && src) {
      retriedRef.current = true;
      setTimeout(() => {
        setEffectiveSrc(`${src}${src.includes("?") ? "&" : "?"}r=${Date.now()}`);
      }, 600);
    } else {
      setFailed(true);
    }
  }, [src]);

  return { effectiveSrc, failed, onError };
}

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
  const { effectiveSrc, failed, onError } = useRetryOnceSrc(src);
  const [isLoading, setIsLoading] = useState(true);

  // New (or retried) src => show the loading veil again so a broken-image glyph
  // never flashes during the retry window.
  useEffect(() => {
    setIsLoading(true);
  }, [effectiveSrc]);

  if (!effectiveSrc || failed) {
    return <ImagePlaceholder className={className} />;
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={effectiveSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchpriority: "high" } : {})}
        onLoad={() => setIsLoading(false)}
        onError={onError}
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
  const { effectiveSrc, failed, onError } = useRetryOnceSrc(src);

  if (!effectiveSrc || failed) {
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
        src={effectiveSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={onError}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
});
