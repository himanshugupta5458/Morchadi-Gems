import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/config";
import { getCodEligibilityCatalogue } from "@/lib/products";
import { AddressCheckout } from "@/components/AddressCheckout";
import { CheckoutHeader } from "@/components/CheckoutHeader";

/**
 * A checkout step is per-visitor and useless to land on cold, so it is not indexed. `follow`
 * stays on so the links back to the cart and the policies still count.
 */
export const metadata: Metadata = {
  title: "Delivery Address",
  description: `Enter your delivery details to complete your ${SITE_CONFIG.brandName} order.`,
  robots: { index: false, follow: true },
};

/**
 * No breadcrumb. The trail used to read Home › Cart › Address, which is three ways out of a
 * funnel with one way forward; the header's step indicator says where the shopper is and its
 * one link says how to go back a step, which is the whole of what a breadcrumb was doing here.
 */
export default function AddressPage(): JSX.Element {
  return (
    <>
      <CheckoutHeader current={1} />

      <div className="container py-6 sm:py-8 lg:py-12">
        <h1 className="font-display text-heading-sm sm:text-heading-lg">
          <span className="uppercase tracking-caps text-ink">Delivery</span>{" "}
          <span className="italic text-gold">Address</span>
        </h1>

        <div className="mt-6 sm:mt-10 lg:mt-12">
          <AddressCheckout codCatalogue={getCodEligibilityCatalogue()} />
        </div>
      </div>
    </>
  );
}
