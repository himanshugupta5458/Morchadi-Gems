"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogueEntry, SelectedOptions } from "@/types/product";
import { selectCardPurchaseMode } from "@/lib/card-purchase";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/lib/toast-context";
import { AddToCartModal } from "@/components/AddToCartModal";

export const ADDED_TO_CART_MESSAGE = "Added to cart";

/** What a button reads while it is confirming in place, beside the toast rather than instead. */
export const ADDED_TO_CART_LABEL = "Added ✓";

/**
 * How long that label stays before the button goes back to inviting the next add.
 *
 * Shorter than the toast, and that is the division of labour: the label says *this button
 * worked* and is read by the thumb that just pressed it, so it only has to survive the glance
 * down; the toast says *something is in your cart* and is read by eyes that have moved on.
 */
export const ADDED_FEEDBACK_MS = 1400;

export interface AddToCartFlow {
  /** True for `ADDED_FEEDBACK_MS` after a successful add, whichever route it took. */
  isJustAdded: boolean;
  /** What a card's Add to cart, or a cross-sell rail's `+`, calls. */
  requestAdd: () => void;
  /** The modal, mounted only while a choice is outstanding. Render it; it portals itself out. */
  modal: JSX.Element | null;
}

/**
 * One add-to-cart interaction, shared by every surface that has an add button and no room to
 * ask a question in place — the product card and the compact cross-sell card today.
 *
 * The whole of the branch is here rather than in each caller, which is the point: a product
 * with no options is added on the spot, a product with any options opens
 * `AddToCartModal`, and no caller gets to decide which. A surface that forgot the second half
 * would silently add a default nobody chose, which is exactly the defect
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md) was opened for — so there is one
 * implementation and it is not optional.
 *
 * Confirmation is doubled deliberately. The button says "Added ✓" in place, because the thumb
 * that pressed it is looking at it; the toast says the same thing bottom-centre, because a
 * shopper adding a third piece from a grid is looking at the grid. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function useAddToCartFlow(item: CatalogueEntry): AddToCartFlow {
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [isChoosing, setIsChoosing] = useState(false);
  const [isJustAdded, setIsJustAdded] = useState(false);

  useEffect(() => {
    if (!isJustAdded) return;

    const resetTimer = window.setTimeout(() => setIsJustAdded(false), ADDED_FEEDBACK_MS);
    return () => window.clearTimeout(resetTimer);
  }, [isJustAdded]);

  const confirmAdd = useCallback(
    (selectedOptions?: SelectedOptions) => {
      addItem(item, 1, selectedOptions);
      showToast(ADDED_TO_CART_MESSAGE);
      setIsJustAdded(true);
    },
    [addItem, item, showToast],
  );

  const requestAdd = useCallback(() => {
    if (selectCardPurchaseMode(item.options).kind === "add") {
      confirmAdd();
      return;
    }
    setIsChoosing(true);
  }, [confirmAdd, item.options]);

  const dismissChoice = useCallback(() => setIsChoosing(false), []);

  const handleChosen = useCallback(
    (selectedOptions: SelectedOptions) => {
      setIsChoosing(false);
      confirmAdd(selectedOptions);
    },
    [confirmAdd],
  );

  return {
    isJustAdded,
    requestAdd,
    modal: isChoosing ? (
      <AddToCartModal item={item} onConfirm={handleChosen} onDismiss={dismissChoice} />
    ) : null,
  };
}
