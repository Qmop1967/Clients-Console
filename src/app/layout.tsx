import type { Metadata } from "next";
import "./globals.css";
import { ErrorReporter } from "@/components/error-reporter";

// PERFORMANCE: Removed unused Geist fonts (~100KB savings)
// Actual fonts are loaded in [locale]/layout.tsx

export const metadata: Metadata = {
  title: "TSH Clients Console",
  description: "TSH Wholesale & Retail Clients Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
