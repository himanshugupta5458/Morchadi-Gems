import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/config";
import { AddressCheckout } from "@/components/AddressCheckout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CheckoutSteps } from "@/components/CheckoutSteps";

/**
 * A checkout step is per-visitor and useless to land on cold, so it is not indexed. `follow`
 * stays on so the links back to the cart and catalogue still count.
 */
export const metadata: Metadata = {
  title: "Delivery Address",
  description: `Enter your delivery details to complete your ${SITE_CONFIG.brandName} order.`,
  robots: { index: false, follow: true },
};

export default function AddressPage(): JSX.Element {
  return (
    <div className="container py-6 sm:py-8 lg:py-12">
      <Breadcrumb
        trail={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Address" },
        ]}
      />

      <h1 className="mt-5 font-display text-heading-sm sm:mt-8 sm:text-heading-lg lg:mt-10">
        <span className="uppercase tracking-caps text-ink">Delivery</span>{" "}
        <span className="italic text-gold">Address</span>
      </h1>

      <div className="mt-6 sm:mt-8">
        <CheckoutSteps current={1} />
      </div>

      <div className="mt-6 sm:mt-10 lg:mt-12">
        <AddressCheckout />
      </div>
    </div>
  );
}
