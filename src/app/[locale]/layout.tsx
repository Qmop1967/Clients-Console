import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { CartSessionProvider } from "@/components/providers/cart-session-provider";
import { SplashProvider } from "@/components/providers/splash-provider";
import { Toaster } from "@/components/ui/toaster";
import { locales, localeDirection, type Locale } from "@/i18n/config";
import "../globals.css";

// Fonts are loaded via CSS @import in globals.css:
// - Display: Cormorant Garamond (serif) - for headings, prices, hero text
// - Body: Plus Jakarta Sans (sans-serif) - for body text, labels
// - Arabic Display: Cairo (serif) - for Arabic headings
// - Arabic Body: IBM Plex Sans Arabic (sans-serif) - for Arabic body text

export const metadata: Metadata = {
  title: {
    default: "TSH Clients Console",
    template: "%s | TSH",
  },
  description: "TSH Wholesale & Retail Clients Portal - Order Management, Invoices, and Account Services",
  keywords: ["TSH", "wholesale", "retail", "orders", "invoices", "Iraq", "IQD"],
  authors: [{ name: "TSH" }],
  creator: "TSH",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TSH",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1C1930" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1930" },
  ],
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();
  const dir = localeDirection[locale as Locale];

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Preconnect to Zoho CDN for faster image loading */}
        <link rel="preconnect" href="https://www.zohoapis.com" />
        <link rel="dns-prefetch" href="https://www.zohoapis.com" />
        {/* Preconnect to font CDNs */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-body antialiased">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <NextIntlClientProvider messages={messages}>
              <CartSessionProvider>
                <SplashProvider>
                  {children}
                </SplashProvider>
                <Toaster />
              </CartSessionProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
