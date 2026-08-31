import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE_CONFIG } from "@/lib/config";
import { getCrossSellShortlists } from "@/lib/products";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { PanelNotice } from "@/components/PanelNotice";

/**
 * Kept out of the index alongside `/address` and `/payment`, and for a stronger reason than
 * either: this URL carries an order number, and an indexed confirmation page is one search
 * result away from being someone else's receipt. `follow` stays on so the links back to the
 * catalogue still count.
 */
export const metadata: Metadata = {
  title: "Order Confirmation",
  description: `Your ${SITE_CONFIG.brandName} order and its payment status.`,
  robots: { index: false, follow: true },
};

/**
 * No breadcrumb, unlike the two steps before it. Cart and Address are dead ends from here — on
 * a confirmed order the cart has just been emptied — and a trail that walks a shopper back
 * into a checkout they have completed invites a second payment.
 */
export default function OrderConfirmationPage(): JSX.Element {
  return (
    <div className="container py-8 lg:py-12">
      <h1 className="font-display text-heading sm:text-heading-lg">
        <span className="uppercase tracking-caps text-ink">Order</span>{" "}
        <span className="italic text-gold">Confirmation</span>
      </h1>

      <div className="mt-8">
        <CheckoutSteps current={3} />
      </div>

      <div className="mt-10 lg:mt-12">
        <Suspense fallback={<PanelNotice>Confirming your payment…</PanelNotice>}>
          <OrderConfirmation crossSellShortlists={getCrossSellShortlists()} />
        </Suspense>
      </div>
    </div>
  );
}
