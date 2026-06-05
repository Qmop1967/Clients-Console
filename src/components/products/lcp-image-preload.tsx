// ============================================
// LCP Image Preload Component
// ============================================
// Adds a <link rel="preload" as="image"> for the above-the-fold product image
// so the browser starts fetching it before React hydration.
//
// NOTE: ProductImage now renders a NATIVE <img> that fetches the Gateway URL
// directly (no /_next/image optimizer). We MUST preload that exact same URL,
// otherwise the preload is wasted and would re-introduce optimizer load.
// ============================================

interface LCPImagePreloadProps {
  imageUrl: string | null;
}

export function LCPImagePreload({ imageUrl }: LCPImagePreloadProps) {
  if (!imageUrl) return null;

  return (
    <link
      rel="preload"
      as="image"
      href={imageUrl}
      // @ts-expect-error - fetchpriority is valid HTML but not yet in React types
      fetchpriority="high"
    />
  );
}
