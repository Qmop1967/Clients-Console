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
      {
        protocol: "https",
        hostname: "*.zoho.com",
      },
      {
        protocol: "https",
        hostname: "*.zohostatic.com",
      },
      {
        protocol: "https",
        hostname: "inventory.zoho.com",
      },
      {
        protocol: "https",
        hostname: "books.zoho.com",
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
    // Enable optimized package imports for smaller bundles
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
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

// Chain plugins: bundle analyzer -> next-intl -> config
export default withBundleAnalyzer(withNextIntl(nextConfig));
