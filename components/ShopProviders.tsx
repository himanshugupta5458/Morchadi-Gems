import type { ReactNode } from "react";
import { getCatalogueIndex } from "@/lib/products";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { UtmCapture } from "@/components/UtmCapture";

/**
 * Everything a shopper-facing screen needs that is not chrome: the cart, the toast host,
 * analytics and campaign capture.
 *
 * It exists because there are now two shopper shells rather than one. `app/(storefront)` is the
 * shop and `app/(checkout)` is the stripped address-and-payment pair, and a nested layout cannot
 * decline what an ancestor renders — so the providers could not simply stay in the storefront
 * layout with the checkout group nested under it. Extracting them means the two shells differ
 * only in what they were split over, which is the header, the footer and the floating button;
 * the cart the shopper is checking out and the campaign they arrived on are shared, and are
 * composed here once rather than written down twice. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md) and, for the same move made
 * between the shop and the admin panel, ADR-044.
 *
 * Analytics is deliberately inside it. A checkout page is where a conversion is measured, so
 * dropping the tag on the two screens closest to the money would have been the one place it
 * matters most to keep it.
 */
export function ShopProviders({
  children,
}: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <>
      <GoogleAnalytics />
      <UtmCapture />
      <CartProvider catalogue={getCatalogueIndex()}>
        <ToastProvider>{children}</ToastProvider>
      </CartProvider>
    </>
  );
}
