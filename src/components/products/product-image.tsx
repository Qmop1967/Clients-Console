"use client";

import { useState, memo, useEffect } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

// Simple gray placeholder - minimal data URL for fast initial render
const PLACEHOLDER_BLUR = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2YwZjBmMCIvPjwvc3ZnPg==";

// Memoized placeholder component for fast render
const ImagePlaceholder = memo(function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-muted", className)}>
      <Package className="h-12 w-12 text-muted-foreground/50" />
    </div>
  );
});

export const ProductImage = memo(function ProductImage({
  src,
  alt,
  className,
  priority = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // PERFORMANCE: Preload high-priority images using browser preload hint
  useEffect(() => {
    if (priority && src && typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, src]);

  // If no source or error occurred, show placeholder immediately
  if (!src || hasError) {
    return <ImagePlaceholder className={className} />;
  }

  // PERFORMANCE: All images go through Next.js optimization
  // Internal proxy images (/api/zoho/images/) now work with Next.js Image
  // The proxy handles caching via Vercel Blob CDN, and Next.js adds optimization

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        quality={priority ? 80 : 75} // Higher quality for priority images
        className={cn(
          "object-contain transition-opacity duration-150",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        placeholder="blur"
        blurDataURL={PLACEHOLDER_BLUR}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        // PERFORMANCE: Let Next.js optimize internal proxy images too
        // This was unoptimized={isInternalProxy} but hurt LCP
        // The proxy already serves optimized images via Vercel Blob CDN
        unoptimized={false}
      />
      {/* Show placeholder only while loading - no animation for performance */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted" />
      )}
    </div>
  );
});

// Smaller variant for list views - memoized for performance
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
      <Image
        src={src}
        alt={alt}
        fill
        sizes="80px"
        quality={60}
        loading="lazy"
        className="object-contain"
        onError={() => setHasError(true)}
        // PERFORMANCE: Use Next.js optimization for all images
        unoptimized={false}
      />
    </div>
  );
});
