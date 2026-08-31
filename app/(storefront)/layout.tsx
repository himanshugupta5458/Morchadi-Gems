import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_CONFIG } from "@/lib/config";
import { buildSiteSchemaGraph } from "@/lib/structured-data";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { ShopProviders } from "@/components/ShopProviders";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export const metadata: Metadata = {
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

/**
 * The shop: header, footer, the floating WhatsApp button, the cart, the toast host, analytics,
 * UTM capture and the site's schema graph.
 *
 * Every line of this used to be in the root layout, which is a thing a nested layout cannot
 * decline — so `/admin` rendered with the shop header above it and the WhatsApp bubble over
 * its bottom-right corner. The route group is what fixes that: `(storefront)` adds no URL
 * segment, so every page below is served at exactly the address it was before, while the
 * chrome now stops at the group's boundary instead of at the document's.
 *
 * The shopper-facing metadata is here for the same reason: an admin page has no Open Graph
 * card and no `%s · Morchadi Gems` title, and inheriting them from the root was how it got
 * both. See [ADR-044](/docs/decisions/ADR-044-admin-order-detail-and-layout-split.md).
 *
 * The same argument was made a second time, one level down, for the address and payment steps:
 * a checkout page has no use for a category menu or a floating chat bubble, and could not
 * decline either while it was nested here. `app/(checkout)` is now a sibling group with its own
 * shell, and the providers both shells need live in `ShopProviders` rather than in this file.
 * See [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */
export default function StorefrontLayout({
  children,
}: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <>
      <JsonLd id="site-schema" graph={buildSiteSchemaGraph()} />
      <ShopProviders>
        <Header />
        <main className="flex-1 pb-16 sm:pb-0">{children}</main>
        <Footer />
        <WhatsAppButton />
      </ShopProviders>
    </>
  );
}
