"use client";

import { useState } from "react";
import type { CatalogueEntry } from "@/types/product";
import { CHOOSE_OPTIONS_LABEL, selectCardPurchaseMode } from "@/lib/card-purchase";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/lib/toast-context";
import { ADDED_TO_CART_MESSAGE } from "@/components/AddToCartButton";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { CardOptionChips } from "@/components/CardOptionChips";

export interface ProductCardPurchaseProps {
  item: CatalogueEntry;
}

/**
 * The height every card reserves for its chip row, filled or not.
 *
 * It is the reason this slot is rendered for an option-less product at all. A grid row holds
 * cards in all three modes side by side, and a row that appeared only on the cards that have
 * options would push their price and button down by its own height and break the shared
 * baseline the fixed title block establishes. Reserved space is what makes the three modes
 * interchangeable in a row. See [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
const CHIP_ROW_HEIGHT_CLASSES = "flex h-8 items-center";

/**
 * And the same for the action itself, because "Choose Your Options" wraps to two lines at every
 * width below a desktop column while "Add to cart" never does. The two buttons take this height
 * through `fillHeight` rather than standing up out of their own padding, so a row of cards has
 * one button height whichever mode each card is in.
 */
const ACTION_HEIGHT_CLASSES = "h-11";

/**
 * The bottom of a product card: the option row, if the product has one this card may ask, and
 * the action.
 *
 * Three shapes, decided by `selectCardPurchaseMode`:
 *
 * - **No options** — Add to cart, exactly as before. Most of the catalogue.
 * - **One group of at most three values** — chips with the catalogue's default pre-selected,
 *   and Add to cart adds whatever is currently selected.
 * - **Anything else** — no add at all. The button reads "Choose Your Options" and is a link to
 *   the product page, so a group this card cannot show is never answered on the shopper's
 *   behalf.
 *
 * The third case is the defect ADR-067 fixes. The card used to send every group's declared
 * default with no visible sign a choice had been made, and `/api/create-order`'s
 * `INVALID_OPTION` guard could not catch it: the value was always one the catalogue offers,
 * merely not one the shopper chose.
 */
export function ProductCardPurchase({ item }: ProductCardPurchaseProps): JSX.Element {
  const { addItem } = useCart();
  const { showToast } = useToast();

  const mode = selectCardPurchaseMode(item.options);
  const [chosenValue, setChosenValue] = useState(() =>
    mode.kind === "choose-on-card" ? mode.option.default : "",
  );

  const isSoldOut = !item.inStock;

  function handleAddToCart(): void {
    if (mode.kind === "choose-on-card") {
      addItem(item, 1, { [mode.option.name]: chosenValue });
    } else {
      addItem(item, 1);
    }
    showToast(ADDED_TO_CART_MESSAGE);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={CHIP_ROW_HEIGHT_CLASSES}>
        {mode.kind === "choose-on-card" ? (
          <div className="w-full">
            <CardOptionChips
              option={mode.option}
              value={chosenValue}
              disabled={isSoldOut}
              onChange={setChosenValue}
            />
          </div>
        ) : null}
      </div>

      <div className={ACTION_HEIGHT_CLASSES}>
        {mode.kind === "choose-on-page" && !isSoldOut ? (
          <ButtonLink
            href={`/product/${item.id}`}
            variant="secondary"
            size="sm"
            fullWidth
            fillHeight
          >
            {CHOOSE_OPTIONS_LABEL}
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            fillHeight
            disabled={isSoldOut}
            onClick={handleAddToCart}
          >
            {isSoldOut ? "Sold out" : "Add to cart"}
          </Button>
        )}
      </div>
    </div>
  );
}
