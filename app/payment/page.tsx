import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { PaymentCheckout } from "@/components/PaymentCheckout";

/**
 * Per-visitor and meaningless to land on cold, so it is kept out of the index alongside
 * `/address`. `follow` stays on so the links back to the cart and catalogue still count.
 */
export const metadata: Metadata = {
  title: "Payment",
  description: "Review your order and pay securely with Cashfree.",
  robots: { index: false, follow: true },
};

export default function PaymentPage(): JSX.Element {
  return (
    <div className="container py-8 lg:py-12">
      <Breadcrumb
        trail={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Address", href: "/address" },
          { label: "Payment" },
        ]}
      />

      <h1 className="mt-8 font-display text-heading sm:text-heading-lg lg:mt-10">
        <span className="uppercase tracking-caps text-ink">Secure</span>{" "}
        <span className="italic text-gold">Payment</span>
      </h1>

      <div className="mt-8">
        <CheckoutSteps current={2} />
      </div>

      <div className="mt-10 lg:mt-12">
        <PaymentCheckout />
      </div>
    </div>
  );
}
