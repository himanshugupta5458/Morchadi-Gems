import type { Metadata } from "next";
import { Fraunces, Jost } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

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
};

/**
 * The document, and nothing else.
 *
 * This layout used to be the storefront: it rendered the header, the footer, the floating
 * WhatsApp button, the cart provider and the site's schema graph, and because a nested layout
 * cannot opt out of an ancestor, every admin page inherited all of it. The panel came with a
 * shop header above it and a WhatsApp bubble floating over its controls.
 *
 * The two shells are now siblings — `app/(storefront)/layout.tsx` and `app/admin/layout.tsx` —
 * and what is left here is the part they genuinely share: one `<html>`, one `<body>`, the two
 * typefaces and the stylesheet. `metadataBase` stays because canonical resolution is a
 * property of the deployment rather than of either shell. See
 * [ADR-044](/docs/decisions/ADR-044-admin-order-detail-and-layout-split.md).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displaySerif.variable} ${bodySans.variable}`}>
      <body className="flex min-h-screen flex-col bg-white font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
