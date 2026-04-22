import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");

// Enable bundle analyzer with ANALYZE=true environment variable
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: true,
});

const nextConfig: NextConfig = {
  // Enable React Compiler for improved performance (Next.js 15)
  reactStrictMode: true,

  // Compression for production builds
  compress: true,

  // Optimize for production
  poweredByHeader: false,

  // Image optimization with aggressive settings for better LCP
  images: {
    remotePatterns: [
      // Odoo server for product images
      {
        protocol: "http",
        hostname: "10.114.0.3",
        port: "8069",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8069",
      },
    ],
    // Prefer WebP over AVIF for faster encoding (better LCP)
    formats: ["image/webp"],
    // Optimized device sizes for common viewports
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Smaller image sizes for thumbnails
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Aggressive caching for images
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days cache
    // Disable static imports to reduce bundle size
    disableStaticImages: false,
  },

  // Experimental features for performance
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // CSS optimization disabled for self-hosted deployment
    // optimizeCss: true,
    // Enable optimized package imports for smaller bundles
    // This tree-shakes unused exports from these packages
    optimizePackageImports: [
      // Icons - only imports used icons
      "lucide-react",
      // Date utilities
      "date-fns",
      // Radix UI components
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-separator",
      "@radix-ui/react-switch",
      // Analytics (tree-shake unused exports)
      // Data fetching
      "swr",
      // Validation
      "zod",
    ],
  },

  // Headers for security and performance
  async headers() {
    return [
      // Security headers for all routes
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      // PERFORMANCE: Stale-while-revalidate for shop pages (public, cacheable)
      {
        source: "/:locale(en|ar)/shop",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
      // PERFORMANCE: Short cache for authenticated pages (dashboard, orders, etc.)
      {
        source: "/:locale(en|ar)/(dashboard|orders|invoices|payments|credit-notes|profile|account-statement)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, s-maxage=60, stale-while-revalidate=120",
          },
        ],
      },
      // Service worker must never be cached — it controls its own updates.
      // Must be served from root scope (Service-Worker-Allowed: /) for iOS PWA.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Cache static assets aggressively
      {
        source: "/:path*.(ico|jpg|jpeg|png|gif|webp|svg|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache fonts
      {
        source: "/:path*.(woff|woff2|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache JS and CSS with versioning support
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache optimized images from Next.js Image component (LCP improvement)
      {
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: "/",
        destination: "/ar/shop",
        permanent: false,
      },
      {
        source: "/en",
        destination: "/en/shop",
        permanent: false,
      },
      {
        source: "/ar",
        destination: "/ar/shop",
        permanent: false,
      },
    ];
  },
};

// Chain plugins: sentry -> bundle analyzer -> next-intl -> config
export default withSentryConfig(withBundleAnalyzer(withNextIntl(nextConfig)), {
  // Sentry options for free tier
  org: "tsh",
  project: "tsh-clients",
  silent: true,
  // Don't upload source maps (saves build time, free tier friendly)
  widenClientFileUpload: false,
  disableLogger: true,
  // Auto-instrument for free tier
  automaticVercelMonitors: false,
});
