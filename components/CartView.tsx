"use client";

import type { CartItem } from "@/types/cart";
import { cartItemKey } from "@/lib/cart";
import { useCart } from "@/lib/cart-context";
import {
  describeCartCodAvailability,
  summariseCartPrepayment,
  type CodEligibilityEntry,
} from "@/lib/cod";
import type { CrossSellShortlists } from "@/lib/cross-sell";
import { formatRupees } from "@/lib/format";
import { CHECKOUT_ADDRESS_PATH } from "@/lib/navigation";
import { useToast } from "@/lib/toast-context";
import { ButtonLink } from "@/components/ButtonLink";
import { CartEmptyState } from "@/components/CartEmptyState";
import { CartLineItem } from "@/components/CartLineItem";
import { CartSummary } from "@/components/CartSummary";
import { CrossSellRow } from "@/components/CrossSellRow";
import { FreeShippingProgress } from "@/components/FreeShippingProgress";
import { PanelNotice } from "@/components/PanelNotice";

export const ITEM_REMOVED_MESSAGE = "Removed from cart";
export const UNDO_REMOVAL_LABEL = "Undo";

export interface CartViewProps {
  /**
   * The cash-on-delivery catalogue, handed down by the Server Component that renders this — the
   * same prop and the same reasoning as `PaymentCheckout`'s: `minPrepaidAmount` lives in an
   * accessor of its own so that no object carrying a price carries it too
   * ([ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md)). What the
   * cart says here is a preview; `/api/create-order` decides it again from the same accessor.
   */
  codCatalogue: readonly CodEligibilityEntry[];
  crossSellShortlists: CrossSellShortlists;
}

/**
 * The whole page below the heading. It renders the loading state until `isHydrated`, because
 * the server has no way to know what is in a cart that lives in localStorage — showing the
 * empty state first and then swapping it for three items would be a flash of wrong content,
 * not a hydration mismatch, and it is worth avoiding on the one page that is entirely about
 * the cart. See ADR-010.
 *
 * **Removal is undoable.** The × used to delete a line outright, and the only way back was to
 * find the piece again and re-choose whatever options it carried. The item and its position are
 * read *before* the removal and handed to the toast, so Undo replays exactly what was there —
 * quantity, recorded choices and place in the list — rather than adding the product again. The
 * offer expires with the toast and nothing is kept after it: there is no undo history here, and
 * a line that is gone when the toast fades is genuinely gone.
 *
 * The free-shipping progress and the cross-sell rail sit under the item list rather than beside
 * the summary, which is both where the empty column was and where they read as one thought: how
 * far off free delivery this basket is, and four pieces from the same shelf that would close it.
 *
 * The bar pinned to the bottom below `lg` carries `data-control="action"` so the floating
 * WhatsApp button reads it as an obstacle and lifts clear of it, rather than parking on top of
 * the one control the bar exists to keep reachable
 * ([ADR-069](/docs/decisions/ADR-069-floating-contact-clearance.md)).
 */
export function CartView({
  codCatalogue,
  crossSellShortlists,
}: CartViewProps): JSX.Element {
  const {
    items,
    lines,
    itemCount,
    subtotal,
    mrpSubtotal,
    shipping,
    total,
    hasUnavailableItems,
    isHydrated,
    removeItem,
    restoreItem,
    setQty,
    setLineOptions,
  } = useCart();
  const { showToast } = useToast();

  function handleRemove(lineKey: string): void {
    const removedIndex = items.findIndex((item) => cartItemKey(item) === lineKey);
    const removedItem: CartItem | undefined = items[removedIndex];

    removeItem(lineKey);

    if (removedItem === undefined) return;

    showToast(ITEM_REMOVED_MESSAGE, {
      label: UNDO_REMOVAL_LABEL,
      onAction: () => restoreItem(removedItem, removedIndex),
    });
  }

  if (!isHydrated) return <PanelNotice>Loading your cart…</PanelNotice>;
  if (lines.length === 0) return <CartEmptyState />;

  const isCheckoutBlocked = hasUnavailableItems || subtotal === 0;
  const prepayment = summariseCartPrepayment(
    lines
      .filter((line) => line.isPayable)
      .map((line) => ({ productId: line.entry.id, qty: line.quantity })),
    codCatalogue,
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div className="flex flex-col">
          <p className="border-b border-line pb-4 text-body-sm text-muted">
            {itemCount === 1 ? "1 piece" : `${itemCount} pieces`} in your cart
          </p>

          <ul aria-label="Pieces in your cart" className="divide-y divide-line">
            {lines.map((line) => (
              <li key={line.key}>
                <CartLineItem
                  line={line}
                  onQuantityChange={setQty}
                  onRemove={handleRemove}
                  onOptionsChange={setLineOptions}
                />
              </li>
            ))}
          </ul>

          {hasUnavailableItems ? (
            <p className="mt-6 border border-sale/30 bg-sale/5 px-4 py-3 text-body-sm text-sale">
              One or more pieces sold out while they were in your cart. Remove them to
              continue to checkout.
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-8 sm:mt-10 sm:gap-10">
            <FreeShippingProgress subtotal={subtotal} />

            <CrossSellRow
              basket={lines
                .filter((line) => line.isPayable)
                .map((line) => ({ productId: line.entry.id, amount: line.lineTotal }))}
              shortlists={crossSellShortlists}
              roman="Complete"
              accent="the Set"
              subtitle="More from the same collection, chosen to go with what is already in your cart."
            />
          </div>
        </div>

        <CartSummary
          subtotal={subtotal}
          mrpSubtotal={mrpSubtotal}
          shipping={shipping}
          total={total}
          isCheckoutBlocked={isCheckoutBlocked}
          codAvailability={describeCartCodAvailability(prepayment)}
        />
      </div>

      {isCheckoutBlocked ? null : (
        <div
          data-control="action"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 shadow-card-hover lg:hidden"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="flex flex-col">
              <span className="text-eyebrow uppercase tracking-caps text-muted">Total</span>
              <span className="font-sans text-body-lg font-medium text-ink">
                {formatRupees(total)}
              </span>
            </span>
            <ButtonLink href={CHECKOUT_ADDRESS_PATH} size="sm">
              Checkout
            </ButtonLink>
          </div>
        </div>
      )}
    </>
  );
}
