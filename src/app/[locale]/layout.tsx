import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { CartSessionProvider } from "@/components/providers/cart-session-provider";
import { Toaster } from "@/components/ui/toaster";
import { locales, localeDirection, type Locale } from "@/i18n/config";
import "../globals.css";

// Performance-optimized fonts using next/font/google
// This prevents render-blocking and enables automatic font subsetting
import { Plus_Jakarta_Sans, Cormorant_Garamond, Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";

// Body font - Latin (used for most UI text)
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
  preload: true,
});

// Display font - Latin (used for headings, prices)
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false, // Don't preload display font - body is more critical
});

// Arabic display font
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
  preload: false, // Preloaded only for Arabic locale
});

// Arabic body font
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-arabic",
  display: "swap",
  preload: false, // Preloaded only for Arabic locale
});

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

  // Combine all font CSS variables
  const fontVariables = `${plusJakartaSans.variable} ${cormorantGaramond.variable} ${cairo.variable} ${ibmPlexSansArabic.variable}`;

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={fontVariables}>
      <head>
        {/* Preconnect to Zoho domains for faster API and image loading */}
        <link rel="preconnect" href="https://www.zohoapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://books.zoho.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.zohoapis.com" />
        <link rel="dns-prefetch" href="https://books.zoho.com" />
        <link rel="dns-prefetch" href="https://inventory.zoho.com" />
        {/* Note: Font preconnects handled automatically by next/font */}
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
                {children}
                <Toaster />
              </CartSessionProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
