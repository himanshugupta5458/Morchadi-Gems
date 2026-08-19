import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CartView } from "@/components/CartView";

/**
 * A cart is per-visitor and has no stable content, so there is nothing here worth indexing
 * and a search result landing on it would be a dead end. `follow` stays on so the links out
 * to the catalogue still count.
 */
export const metadata: Metadata = {
  title: "Your Cart",
  description: "Review the pieces in your Morchadi Gems cart before checkout.",
  robots: { index: false, follow: true },
};

export default function CartPage(): JSX.Element {
  return (
    <div className="container py-6 sm:py-8 lg:py-12">
      <Breadcrumb trail={[{ label: "Home", href: "/" }, { label: "Cart" }]} />

      <h1 className="mt-5 font-display text-heading-sm sm:mt-8 sm:text-heading-lg lg:mt-10">
        <span className="uppercase tracking-caps text-ink">Your</span>{" "}
        <span className="italic text-gold">Cart</span>
      </h1>

      <div className="mt-6 sm:mt-10 lg:mt-12">
        <CartView />
      </div>
    </div>
  );
}
