import Link from "next/link";
import { CART_PATH } from "@/lib/navigation";
import { CheckoutSteps, type CheckoutStepNumber } from "@/components/CheckoutSteps";
import { Wordmark } from "@/components/Wordmark";
import { ArrowRightIcon } from "@/components/icons";

export interface CheckoutHeaderProps {
  current: CheckoutStepNumber;
}

/**
 * The whole of the chrome an address or payment screen gets: the logo, where the shopper is in
 * the three steps, and the one link out — back to the cart.
 *
 * What is deliberately not here is the shop header. A category menu, a collections menu, About
 * and Contact are nine ways to leave a funnel the shopper has already committed to, offered at
 * the top of every screen; the floating WhatsApp bubble is a tenth, and it also sits over the
 * bottom-right of a form. Neither is a loss at this point in the journey, because the two
 * questions they answer — who do I ask, and what happens if this goes wrong — are answered in
 * place instead, by `CheckoutTrustStrip` and the support address it carries.
 *
 * A Server Component taking the step as a prop rather than a client one reading the pathname:
 * each page already knows which step it is, and passing the number is one fewer client bundle
 * on the two screens where the shopper is waiting on a redirect.
 *
 * The step indicator lives here rather than on the page below it, which is the one structural
 * change from the previous layout — it belongs with the logo now that the logo row is the only
 * chrome there is. See [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */
export function CheckoutHeader({ current }: CheckoutHeaderProps): JSX.Element {
  return (
    <header className="border-b border-line bg-white">
      <div className="container flex h-16 items-center justify-between gap-4 lg:h-20">
        <Wordmark priority />

        <Link
          href={CART_PATH}
          className="group inline-flex items-center gap-2 text-label uppercase tracking-caps text-muted transition-colors duration-250 hover:text-ink"
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180 transition-transform duration-250 group-hover:-translate-x-1" />
          Back to cart
        </Link>
      </div>

      <div className="container pb-4 sm:pb-5">
        <CheckoutSteps current={current} />
      </div>
    </header>
  );
}
