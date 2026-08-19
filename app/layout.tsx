import type { Metadata } from "next";
import { Fraunces, Jost } from "next/font/google";
import "./globals.css";
import { SITE_CONFIG } from "@/lib/config";
import { getSiteUrl } from "@/lib/site-url";
import { buildSiteSchemaGraph } from "@/lib/structured-data";
import { getCatalogueIndex } from "@/lib/products";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { WhatsAppButton } from "@/components/WhatsAppButton";

const displaySerif = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const bodySans = Jost({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

/**
 * Every relative `alternates.canonical` and `openGraph.url` on every page is resolved against
 * this, so the one place a deployment's origin is decided is `lib/site-url.ts`.
 */
const BASE_URL = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: SITE_CONFIG.title,
    template: `%s · ${SITE_CONFIG.brandName}`,
  },
  description: SITE_CONFIG.description,
  openGraph: {
    type: "website",
    siteName: SITE_CONFIG.brandName,
    locale: "en_IN",
    url: "/",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage.url],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displaySerif.variable} ${bodySans.variable}`}>
      <body className="flex min-h-screen flex-col bg-white font-sans text-ink antialiased">
        <JsonLd id="site-schema" graph={buildSiteSchemaGraph()} />
        <CartProvider catalogue={getCatalogueIndex()}>
          <ToastProvider>
            <Header />
            <main className="flex-1 pb-16 sm:pb-0">{children}</main>
            <Footer />
            <WhatsAppButton />
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}
