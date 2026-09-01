"use client";

import type { CatalogueEntry } from "@/types/product";
import { ADDED_TO_CART_LABEL, useAddToCartFlow } from "@/lib/add-to-cart-flow";
import { Button } from "@/components/Button";

export interface ProductCardPurchaseProps {
  item: CatalogueEntry;
}

/**
 * The height every card reserves for its action.
 *
 * 40px, down from 44px, and it is still a reserved box rather than padding for one reason: it
 * is the only thing on the card whose label changes — "Add to cart" becomes "Added ✓" for a
 * second and a half after a tap, and "Sold out" on a piece that has none left. A button that
 * stood up out of its own padding would be the same height for all three today and would stop
 * being so the first time a label got longer. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
const ACTION_HEIGHT_CLASSES = "h-10";

/**
 * The bottom of a product card: one button, on every card, whatever the product carries.
 *
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md) gave a card three shapes — a
 * plain add, a row of chips, or a "Choose Your Options" link to the product page — chosen by
 * how risky the product's option groups were to ask about in a 200px tile. All three are gone.
 * A card with options opens `AddToCartModal`, a card without one adds in a tap, and the two are
 * indistinguishable until they are pressed.
 *
 * The defect that started ADR-067 is still fixed, by a stricter rule than it used: the card
 * sends no option value at all. It cannot record a choice nobody made because it does not
 * record choices. `useAddToCartFlow` owns that branch so no surface can forget it.
 */
export function ProductCardPurchase({ item }: ProductCardPurchaseProps): JSX.Element {
  const { isJustAdded, requestAdd, modal } = useAddToCartFlow(item);
  const isSoldOut = !item.inStock;

  return (
    <div className={ACTION_HEIGHT_CLASSES}>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        fillHeight
        disabled={isSoldOut}
        onClick={requestAdd}
      >
        {isSoldOut ? "Sold out" : isJustAdded ? ADDED_TO_CART_LABEL : "Add to cart"}
      </Button>
      {modal}
    </div>
  );
}
