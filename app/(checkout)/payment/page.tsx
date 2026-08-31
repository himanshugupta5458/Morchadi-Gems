import type { Metadata } from "next";
import { getCodEligibilityCatalogue } from "@/lib/products";
import { CheckoutHeader } from "@/components/CheckoutHeader";
import { PaymentCheckout } from "@/components/PaymentCheckout";

/**
 * Per-visitor and meaningless to land on cold, so it is kept out of the index alongside
 * `/address`. `follow` stays on so the links back to the cart and the policies still count.
 */
export const metadata: Metadata = {
  title: "Payment",
  description: "Review your order and pay securely with Cashfree.",
  robots: { index: false, follow: true },
};

export default function PaymentPage(): JSX.Element {
  return (
    <>
      <CheckoutHeader current={2} />

      <div className="container py-6 sm:py-8 lg:py-12">
        <h1 className="font-display text-heading-sm sm:text-heading-lg">
          <span className="uppercase tracking-caps text-ink">Secure</span>{" "}
          <span className="italic text-gold">Payment</span>
        </h1>

        <div className="mt-6 sm:mt-10 lg:mt-12">
          <PaymentCheckout codCatalogue={getCodEligibilityCatalogue()} />
        </div>
      </div>
    </>
  );
}
