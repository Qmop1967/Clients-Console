import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");

const nextConfig: NextConfig = {
  // Image optimization
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
    formats: ["image/avif", "image/webp"],
  },

  // Experimental features for performance
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Headers for security
  async headers() {
    return [
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

export default withNextIntl(nextConfig);
