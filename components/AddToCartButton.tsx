"use client";

import type { CatalogueEntry } from "@/types/product";
import {
  ADDED_TO_CART_LABEL,
  ADDED_TO_CART_MESSAGE,
  useAddToCartFlow,
} from "@/lib/add-to-cart-flow";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/Button";

export { ADDED_TO_CART_MESSAGE };

export interface AddToCartButtonProps {
  item: CatalogueEntry;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/**
 * A standalone add button, for a surface that has a `CatalogueEntry` and no purchase panel of
 * its own — the style guide, and whatever comes next.
 *
 * It goes through `useAddToCartFlow` rather than calling `addItem` directly, so a product with
 * options opens the modal here exactly as it does on a card. A button that added straight to
 * the cart would be sending option defaults nobody chose, which is the whole of what
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md) removed.
 */
export function AddToCartButton({
  item,
  variant = "secondary",
  size = "sm",
  fullWidth = false,
}: AddToCartButtonProps): JSX.Element {
  const { isJustAdded, requestAdd, modal } = useAddToCartFlow(item);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        disabled={!item.inStock}
        onClick={requestAdd}
      >
        {!item.inStock ? "Sold out" : isJustAdded ? ADDED_TO_CART_LABEL : "Add to cart"}
      </Button>
      {modal}
    </>
  );
}
