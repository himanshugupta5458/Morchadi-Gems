"use client";

import Link from "next/link";
import { DELIVERY_ESTIMATE_LINE } from "@/lib/config";
import { CHECKOUT_ADDRESS_PATH } from "@/lib/navigation";
import { SHOP_PATH } from "@/lib/shop-query";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { CheckoutTrustStrip } from "@/components/CheckoutTrustStrip";
import { OrderTotals } from "@/components/OrderTotals";

export interface CartSummaryProps {
  subtotal: number;
  /** The same lines at their compare-at prices, for the MRP and savings rows. */
  mrpSubtotal: number;
  shipping: number;
  total: number;
  isCheckoutBlocked: boolean;
  /**
   * What this basket may be told about paying at the door, from `describeCartCodAvailability`
   * over the shop's own eligibility rule. Never a sentence typed onto this page.
   */
  codAvailability: string;
}

/**
 * The cart's right-hand column: what this order comes to, the one action that moves it forward,
 * and the reassurance a shopper wants before pressing it.
 *
 * **One primary action.** "Continue shopping" used to be a full-width secondary button directly
 * under Proceed to checkout, which is two equally weighted choices at the one moment the page
 * has a single job. It is a text link now, because leaving is always available and never needs
 * advertising at the same size as staying.
 *
 * **`lg:self-start` is what makes `lg:sticky` do anything.** A grid item is stretched to its
 * row's height by default, so the summary filled its own containing block and had nowhere to
 * travel: the class was on the element for two prompts and the panel scrolled away with the page
 * regardless. Pinning the item to the top of its row is what gives the sticky box the slack it
 * needs, and it is the same one-word fix `CheckoutSummary` needed.
 *
 * The trust line under the button is the strip rather than a sentence about pricing. "Prices
 * are confirmed against the catalogue when your order is created" was true, and it answered a
 * question nobody standing in a cart is asking; what they are asking is who takes the money,
 * what happens if the piece is wrong, and whether it reaches them.
 */
export function CartSummary({
  subtotal,
  mrpSubtotal,
  shipping,
  total,
  isCheckoutBlocked,
  codAvailability,
}: CartSummaryProps): JSX.Element {
  return (
    <div className="border border-line bg-ivory p-4 sm:p-6 lg:sticky lg:top-32 lg:self-start">
      <h2 className="font-display text-heading-sm text-ink">Order summary</h2>

      <div className="mt-5 sm:mt-6">
        <OrderTotals
          subtotal={subtotal}
          mrpSubtotal={mrpSubtotal}
          shipping={shipping}
          total={total}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:mt-6">
        {isCheckoutBlocked ? (
          <Button fullWidth disabled>
            Proceed to checkout
          </Button>
        ) : (
          <ButtonLink href={CHECKOUT_ADDRESS_PATH} fullWidth>
            Proceed to checkout
          </ButtonLink>
        )}

        <p className="text-center text-body-sm text-muted">
          <Link
            href={SHOP_PATH}
            className="underline underline-offset-4 transition-colors duration-250 hover:text-ink"
          >
            Continue shopping
          </Link>
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:mt-6 sm:pt-6">
        <p className="text-body-sm text-muted">{DELIVERY_ESTIMATE_LINE}</p>
        <p className="text-body-sm text-muted">{codAvailability}</p>
        <CheckoutTrustStrip />
      </div>
    </div>
  );
}
