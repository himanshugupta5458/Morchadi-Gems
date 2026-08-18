"use client";

import type { CatalogueEntry } from "@/types/product";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/lib/toast-context";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/Button";

export const ADDED_TO_CART_MESSAGE = "Added to cart";

export interface AddToCartButtonProps {
  item: CatalogueEntry;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/**
 * The interactive island a Server Component slots into an otherwise static card. It takes a
 * `CatalogueEntry` rather than a `Product` so a card grid serialises five fields per product
 * instead of a full record with reviews and details.
 */
export function AddToCartButton({
  item,
  variant = "secondary",
  size = "sm",
  fullWidth = false,
}: AddToCartButtonProps): JSX.Element {
  const { addItem } = useCart();
  const { showToast } = useToast();

  function handleAddToCart(): void {
    addItem(item, 1);
    showToast(ADDED_TO_CART_MESSAGE);
  }

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      disabled={!item.inStock}
      onClick={handleAddToCart}
    >
      {item.inStock ? "Add to cart" : "Sold out"}
    </Button>
  );
}
