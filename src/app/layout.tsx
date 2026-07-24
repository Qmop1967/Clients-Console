import type { Metadata } from "next";
import "./globals.css";

// The single <html>/<body> lives in src/app/[locale]/layout.tsx so lang/dir are
// server-rendered per locale. This root layout is a pass-through: rendering its own
// <html>/<body> here produced nested duplicate tags. Global client mounts (chunk
// reloader, version watcher, error reporter, service worker, offline/update banners)
// now live in the locale <body>. The root page only redirects to a locale.

export const metadata: Metadata = {
  title: "TSH Clients Console",
  description: "TSH Wholesale & Retail Clients Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
